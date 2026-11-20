import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownLeft, ArrowDownToLine, ArrowLeft, ArrowUpRight, BookOpen, Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, ChevronUp, Copy,
  Ellipsis, FunctionSquare, GraduationCap, GripVertical, House, Minus, Settings2, Undo2, Variable, X,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { usesNativeDigits } from '../لغات/numerals';
import { copyChatText } from '../utils/clipboard';
import { EngineeringError, ENGINEERING_EXPRESSION_LIMIT, ENGINEERING_VARIABLES, evaluateEngineeringValue, evaluateStandardValue, normalizeEngineeringInput, previewEngineeringValue, previewStandardValue, type AngleMode, type EngineeringValue, type EngineeringVariable, type EvaluateOptions } from '../utils/engineeringCalculator';
import { CalculatorModes, MODES, type CalcMode, type ToolMode, type WorksheetMode } from './engineering/CalculatorModes';
import { CalcInput, CalcSelect } from './engineering/calculatorFields';
import { CATALOG, FUNCTION_KEYS, NUMBER_KEYS, STANDARD_KEYS, type CalcKey } from './engineering/calculatorCatalog';
import { copyableNumber, displayDigits, displayNumber, exactDecimalText, FORMAT_LABEL, FORMAT_TAG, FORMATS, formatReadout, loadCalculatorPreferences, persistCalculatorPreferences, type CalcFormat, type Readout } from './engineering/calculatorDisplay';
import { useFloatingCalculator } from './engineering/useFloatingCalculator';
import { ENGINEERING_WINDOW_ID } from './clock/ClockCalculatorLauncher';
import './engineering/calculator.css';

type Layer = 'home' | 'settings' | 'catalog' | 'format' | 'variables' | 'functions' | 'tools' | 'history';
interface LogEntry { text: string; result: EngineeringValue }
interface Worksheet { text: string; result?: EngineeringValue; answer?: EngineeringValue; error?: Error; history: LogEntry[]; replay?: number; draft?: string }
const isWorksheet = (mode: CalcMode): mode is WorksheetMode => mode === 'standard' || mode === 'calculate' || mode === 'complex';
const binaryStart = /^(?:[+−–\-×*/÷^²³!%٪]|\s+mod\s+)/;
const entryKey = /^[0-9a-z()+\-*/.^,%!π×÷√−–٫،٪²³سᴇ]$/i;
const canEnterKey = (key: string) => key.length === 1 && (entryKey.test(key) || /^\d$/.test(normalizeEngineeringInput(key)));
const zero = evaluateEngineeringValue('0');

function Key({ children, label, click, className = '', cap, pressed, disabled }: { children: ReactNode; label: string; click: () => void; className?: string; cap?: string; pressed?: boolean; disabled?: boolean }) {
  return <button type="button" className={`cw-key ${className}`} title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={click}>
    {children}{cap && <span className="cw-cap" aria-hidden="true">{cap}</span>}
  </button>;
}

function LCDValue({ value }: { value: Readout }) {
  if ('text' in value) {
    const [mantissa, exp] = value.text.split('×10^');
    // Only split plain scientific notation, not a complex expression with two terms.
    if (exp && !exp.includes(' ') && !exp.includes('i') && value.text.indexOf('×10^') === value.text.lastIndexOf('×10^')) return <>{mantissa}×10<sup>{exp}</sup></>;
    return <>{value.text}</>;
  }
  return <span className="cw-fraction-layout" aria-label={`${value.sign || ''}${value.whole ? `${value.whole} ` : ''}${value.top}/${value.bottom}`}>
    {value.sign}{value.whole}<span className="cw-fraction" aria-hidden="true"><span>{value.top}</span><span>{value.bottom}</span></span>
  </span>;
}

export function EngineeringCalculator({ currentLang, minimized, behindModal, onMinimize, onRestore, onClose }: { currentLang: SupportedLanguage; minimized: boolean; behindModal: boolean; onMinimize: () => void; onRestore: () => void; onClose: () => void }) {
  const ar = currentLang === 'ar';
  const nativeDigits = usesNativeDigits(currentLang);
  const t = (arabic: string, english: string) => ar ? arabic : english;
  const d = (value: string) => displayDigits(value, currentLang);
  const titleId = useId();
  const expressionId = useId();
  const floating = useFloatingCalculator(minimized);
  const [prefs, setPrefs] = useState(loadCalculatorPreferences);
  const [mode, setMode] = useState<CalcMode>('standard');
  const [visited, setVisited] = useState<ToolMode[]>([]);
  const [studySeed, setStudySeed] = useState<{ id: number; text: string }>();
  const [layer, setLayer] = useState<Layer | null>(null);
  const [shift, setShift] = useState(false);
  const [catalog, setCatalog] = useState<(typeof CATALOG)[number]['id']>('numeric');
  const [notice, setNotice] = useState('');
  const [sheets, setSheets] = useState<Record<WorksheetMode, Worksheet>>({ standard: { text: '', history: [] }, calculate: { text: '', history: [] }, complex: { text: '', history: [] } });
  const worksheetMode = isWorksheet(mode) ? mode : 'calculate';
  const sheet = sheets[worksheetMode];
  const expressionRef = useRef<HTMLInputElement>(null);
  const cursor = useRef({ start: 0, end: 0 });
  const pendingSelection = useRef<number | null>(null);
  const undoStack = useRef<Record<WorksheetMode, string[]>>({ standard: [], calculate: [], complex: [] });
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);
  const homeCursor = useRef(0);
  const requestMenuFocus = useRef(false);
  const { angle, format, precision, functions, variables } = prefs;
  const standard = mode === 'standard';
  const effectiveFormat = standard ? 'decimal' : format === 'polar' && mode !== 'complex' ? 'math' : format;
  const evalOptions = useMemo<EvaluateOptions>(() => ({ angleMode: angle, variables, functions, answer: sheet.answer }), [angle, variables, functions, sheet.answer]);
  // Keep the live readout separate. Only EXE advances Ans/history or starts a new expression after a result.
  const preview = useMemo(() => !minimized && isWorksheet(mode) && !sheet.result && !sheet.error
    ? (mode === 'standard' ? previewStandardValue(sheet.text, evalOptions.answer)
      : previewEngineeringValue(sheet.text, { ...evalOptions, complex: mode === 'complex' })) : undefined,
  [minimized, mode, sheet.text, sheet.result, sheet.error, evalOptions]);
  const visibleResult = sheet.result ?? (preview?.status === 'value' ? preview.value : undefined);
  const standardDecimal = standard && visibleResult ? exactDecimalText(visibleResult, currentLang) : undefined;
  const readout = !layer && isWorksheet(mode) && visibleResult ? standardDecimal ? { text: standardDecimal }
    : formatReadout(visibleResult, standard && visibleResult.exact?.denominator === 1n ? 'math' : effectiveFormat, precision, angle, currentLang) : undefined;
  const decimalEquivalent = visibleResult && readout && 'top' in readout ? exactDecimalText(visibleResult, currentLang) : undefined;

  useEffect(() => { persistCalculatorPreferences(prefs); }, [prefs]);
  useEffect(() => () => { window.clearTimeout(noticeTimer.current); }, []);
  useLayoutEffect(() => {
    const pos = pendingSelection.current;
    if (pos !== null && expressionRef.current && !layer && !minimized && isWorksheet(mode)) {
      expressionRef.current.setSelectionRange(pos, pos);
      cursor.current = { start: pos, end: pos };
      pendingSelection.current = null;
    }
    if (requestMenuFocus.current && menuRef.current && !minimized) {
      (menuRef.current.querySelector('button.cw-app-tile[aria-current="true"]') as HTMLButtonElement | null ?? menuRef.current.querySelector('button'))?.focus({ preventScroll: true });
      requestMenuFocus.current = false;
    }
  });

  const notify = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2000);
  };
  const updateSheet = (updater: (prev: Worksheet) => Worksheet) => setSheets((prev) => ({ ...prev, [worksheetMode]: updater(prev[worksheetMode]) }));
  const rememberEdit = () => { undoStack.current[worksheetMode] = [...undoStack.current[worksheetMode].slice(-39), sheet.text]; };
  const edit = (text: string, caret?: number, remember = true) => {
    if (text.length > ENGINEERING_EXPRESSION_LIMIT) { notify(t('التعبير طويل', 'Expression is too long')); return; }
    if (remember && text !== sheet.text) rememberEdit();
    if (caret !== undefined) {
      const position = Math.max(0, Math.min(caret, text.length));
      cursor.current = { start: position, end: position };
      pendingSelection.current = position;
    }
    updateSheet((current) => ({ ...current, text, result: undefined, error: undefined, replay: undefined, draft: undefined }));
  };
  const showLayer = (next: Layer) => {
    setShift(false);
    setNotice('');
    if (layer === next) { setLayer(null); return; }
    if (next === 'home') homeCursor.current = MODES.findIndex((item) => item.id === mode);
    requestMenuFocus.current = true;
    setLayer(next);
  };
  const closeLayer = () => {
    setLayer(null);
    floating.windowRef.current?.focus({ preventScroll: true });
  };
  const selectMode = (next: CalcMode) => {
    setMode(next);
    closeLayer();
    floating.windowRef.current?.scrollTo({ top: 0 });
    setShift(false);
    setNotice('');
    if (isWorksheet(next)) pendingSelection.current = sheets[next].text.length;
    else setVisited((prev) => prev.includes(next) ? prev : [...prev, next]);
  };
  const openTool = (next: ToolMode) => selectMode(next);
  const rememberCursor = () => {
    const input = expressionRef.current;
    if (input) cursor.current = { start: input.selectionStart ?? sheet.text.length, end: input.selectionEnd ?? sheet.text.length };
  };
  const atExecutedResult = () => Boolean(sheet.result && sheet.replay === undefined && cursor.current.start === sheet.text.length && cursor.current.end === sheet.text.length);
  const insert = (value: string, append = false) => {
    if (!isWorksheet(mode) || !value) return;
    const fromResult = !append && atExecutedResult();
    const text = fromResult ? (binaryStart.test(value) ? 'Ans' : '') : sheet.text;
    const start = fromResult ? text.length : Math.min(cursor.current.start, text.length);
    const end = fromResult ? text.length : Math.min(cursor.current.end, text.length);
    if (value === ')' && start === end && text[start] === ')') { edit(text, start + 1, false); return; }
    const paired = value.endsWith('(');
    const selected = text.slice(start, end);
    const insertion = paired ? `${value}${selected})` : value;
    // Store exactly one numeric token when pressing a localized digit key; keyboard numbers remain editable as typed.
    const shown = nativeDigits ? d(insertion).replace(/\./g, '٫') : insertion;
    edit(text.slice(0, start) + shown + text.slice(end), start + (paired && !selected ? value.length : shown.length));
  };
  const enterExponent = () => {
    if (atExecutedResult()) { insert('×10^('); return; }
    const before = normalizeEngineeringInput(sheet.text.slice(0, cursor.current.start));
    if (!before.trim() && !sheet.text.trim()) { insert('1ᴇ'); return; }
    if (/(?:^|[+\-*/^,(])\s*(?:\d+(?:\.\d*)?|\.\d+)$/.test(before) && !/(?:[0-9.])[eEᴇ][+-]?\d+$/.test(before)) { insert('ᴇ', true); return; }
    notify(t('اكتب العدد الأول قبل أسّ العشرة.', 'Enter a mantissa before the base-ten exponent.'));
  };
  const erase = () => {
    if (!isWorksheet(mode)) return;
    const text = sheet.text;
    let { start, end } = cursor.current;
    if (start === end && start > 0) {
      const token = text.slice(0, start).match(/(?:[a-zA-Z]+|√)\($/);
      if (token && text[start] === ')') { start -= token[0].length; end++; }
      else if (text[start - 1] === '(' && text[start] === ')') { start--; end++; }
      else start--;
    }
    edit(text.slice(0, start) + text.slice(end), start);
  };
  const undo = () => {
    if (!isWorksheet(mode)) return;
    const text = undoStack.current[worksheetMode].pop();
    if (text !== undefined) edit(text, text.length, false);
  };
  const exe = () => {
    if (!isWorksheet(mode) || !sheet.text.trim()) return;
    try {
      const result = standard ? evaluateStandardValue(sheet.text, sheet.answer)
        : evaluateEngineeringValue(sheet.text, { ...evalOptions, complex: mode === 'complex' });
      pendingSelection.current = sheet.text.length;
      const entry = { text: sheet.text, result };
      const last = sheet.history[0];
      const history = last?.text === entry.text && last.result.re === result.re && last.result.im === result.im
        && last.result.exact?.numerator === result.exact?.numerator && last.result.exact?.denominator === result.exact?.denominator && last.result.exact?.symbol === result.exact?.symbol
        ? sheet.history : [entry, ...sheet.history].slice(0, 40);
      updateSheet((current) => ({ ...current, result, answer: result, history, error: undefined, replay: undefined, draft: undefined }));
    } catch (error) {
      updateSheet((current) => ({ ...current, result: undefined, error: error instanceof Error ? error : new Error('Invalid expression.') }));
    }
  };
  const selectHistory = (index: number) => {
    const entry = sheet.history[index];
    if (!entry) return;
    closeLayer();
    pendingSelection.current = entry.text.length;
    updateSheet((current) => ({ ...current, text: entry.text, result: entry.result, error: undefined, replay: index, draft: current.draft ?? (current.result ? '' : current.text) }));
  };
  const replay = (delta: number) => {
    if (!isWorksheet(mode) || !sheet.history.length) return;
    const index = (sheet.replay ?? -1) + delta;
    if (index < 0) {
      if (sheet.replay !== undefined) edit(sheet.draft ?? '', (sheet.draft ?? '').length, false);
      return;
    }
    selectHistory(Math.min(index, sheet.history.length - 1));
  };
  const moveCursor = (delta: number) => {
    if (!isWorksheet(mode) || layer || !expressionRef.current) return;
    const input = expressionRef.current;
    const next = Math.max(0, Math.min(sheet.text.length, (delta < 0 ? cursor.current.start : cursor.current.end) + delta));
    cursor.current = { start: next, end: next };
    input.setSelectionRange(next, next);
    // Do not summon the on-screen keyboard just to move the calculator cursor.
    if (!window.matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
    if (sheet.result) updateSheet((current) => ({ ...current, result: undefined }));
  };
  const variableSet = (key: EngineeringVariable, value: EngineeringValue) => setPrefs((current) => ({ ...current, variables: { ...current.variables, [key]: value } }));
  const changeMemory = (op: '+' | '-') => {
    if (!sheet.answer) return;
    try { variableSet('A', evaluateEngineeringValue(`A${op}Ans`, { variables, answer: sheet.answer, complex: true })); }
    catch { notify(t('الناتج خارج نطاق الذاكرة.', 'The memory result is outside the supported range.')); }
  };
  const updateFunction = (key: 'f' | 'g', text: string) => setPrefs((current) => ({ ...current, functions: { ...current.functions, [key]: text } }));
  const pickAngle = (next: AngleMode) => {
    if (angle === next) return;
    setPrefs((current) => ({ ...current, angle: next }));
    setSheets((prev) => ({ ...prev, calculate: { ...prev.calculate, result: undefined, error: undefined }, complex: { ...prev.complex, result: undefined, error: undefined } }));
  };
  const pickFormat = (next: CalcFormat) => { setPrefs((current) => ({ ...current, format: next })); closeLayer(); };
  const copy = async () => {
    if (!visibleResult) return;
    const decimal = standard ? exactDecimalText(visibleResult, 'en')?.replace('−', '-') : undefined;
    const exactOutput = standard ? visibleResult.exact?.denominator === 1n : effectiveFormat === 'math' || effectiveFormat === 'mixed' || effectiveFormat === 'recurring';
    const ok = await copyChatText(decimal ?? copyableNumber(visibleResult, exactOutput));
    notify(ok ? t('اتنسخ الناتج', 'Result copied') : t('النسخ غير متاح', 'Clipboard unavailable'));
  };
  const primeFactors = () => {
    const value = visibleResult;
    if (!value || value.im || !Number.isInteger(value.re) || value.re < 2 || value.re > 1e12) return;
    const factors: number[] = [];
    let n = value.re;
    for (let factor = 2; factor * factor <= n; factor += factor === 2 ? 1 : 2) {
      while (n % factor === 0) { factors.push(factor); n /= factor; }
    }
    if (n > 1) factors.push(n);
    notify(factors.map((v) => displayNumber(v, currentLang)).join(' × '));
  };
  const back = () => { if (layer) closeLayer(); else if (mode !== 'calculate' && !standard) showLayer('home'); else undo(); };
  const useKey = (key: CalcKey) => {
    if (key.action === 'format') { showLayer('format'); return; }
    if (key.action === 'clear') edit('', 0);
    else if (key.action === 'del') erase();
    else if (key.action === 'execute') exe();
    else if (key.action === 'exponent' && !shift) enterExponent();
    else insert(shift && key.shift !== undefined ? key.shift : key.insert ?? '');
    setShift(false);
  };
  const shortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (layer) closeLayer(); else onClose();
      return;
    }
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing || !isWorksheet(mode) || layer) return;
    const inInput = event.target === expressionRef.current;
    const key = event.key;
    if ((key === 'Enter' && (inInput || event.target === floating.windowRef.current)) || key === '=') { event.preventDefault(); exe(); }
    else if (key === 'ArrowUp' || key === 'ArrowDown') { event.preventDefault(); replay(key === 'ArrowUp' ? 1 : -1); }
    else if (!inInput && (key === 'ArrowLeft' || key === 'ArrowRight')) { event.preventDefault(); moveCursor(key === 'ArrowLeft' ? -1 : 1); }
    else if (!inInput && key === 'Backspace') { event.preventDefault(); erase(); }
    else if (canEnterKey(key)) {
      if (inInput) rememberCursor();
      if (!inInput || atExecutedResult()) { event.preventDefault(); insert(key); }
    }
  };

  const active = MODES.find((item) => item.id === mode)!;
  const KeyIcon = active.icon;
  const modeLabel = t(active.label[0], active.label[1]);
  const layerTitle: Record<Layer, [string, string]> = {
    home: ['أوضاع الحاسبة', 'Calculator apps'], settings: ['الإعدادات', 'Settings'], catalog: ['دليل الدوال', 'Function catalog'],
    format: ['صيغة الناتج', 'Result format'], variables: ['ذاكرة المتغيرات', 'Variable memory'], functions: ['ذاكرة الدوال', 'Function memory'],
    tools: ['أدوات الحساب', 'Calculation tools'], history: ['سجل الحسابات', 'Calculation history'],
  };
  const availableFormats = FORMATS.filter((choice) => choice !== 'polar' || mode === 'complex');
  const errorText = sheet.error && t(sheet.error instanceof EngineeringError
    ? ({ math: standard ? 'تعذّر الحساب. راجع الأرقام والقسمة على صفر.' : 'خطأ حسابي: راجع مجال الدالة والقيم.',
      syntax: standard ? 'اكتب الأرقام والعملية كاملة. للأقواس والدوال اختار حساب علمي.' : 'خطأ في الصيغة: راجع الرموز والأقواس.',
      limit: 'الحساب أكبر من الحد المدعوم.' }[sheet.error.kind]) : 'تعذّر الحساب.', sheet.error.message);
  const catalogTabs = CATALOG.filter((entry) => entry.id !== 'complex' || mode === 'complex');
  const entries = (catalogTabs.find((entry) => entry.id === catalog) ?? catalogTabs[0]).entries;
  const renderKeys = (keys: CalcKey[], kind: 'functions' | 'numbers' | 'standard-keys') => <div className={`cw-keys cw-${kind}`} dir="ltr">
    {keys.map((key) => {
      const face = key.face === '.' && nativeDigits ? '٫' : d(key.face);
      const label = shift && key.shift !== undefined ? key.alt! : key.label ? t(...key.label) : key.face === '.' && ar ? 'فاصلة عشرية' : face;
      return <button type="button" key={key.face} className={`cw-key ${key.tone ? `cw-key-${key.tone}` : ''} ${key.face.length > 2 ? 'cw-key-caption' : ''}`} title={label} aria-label={label} onClick={() => useKey(key)}>
        {key.alt && <span className="cw-alt" aria-hidden="true">{d(key.alt)}</span>}
        <span className={shift && key.shift !== undefined ? 'cw-key-muted' : undefined}>{face}</span>
      </button>;
    })}
  </div>;
  const moveHome = (offset: number) => {
    const next = Math.max(0, Math.min(MODES.length - 1, homeCursor.current + offset));
    menuRef.current?.querySelector<HTMLButtonElement>(`[data-mode-index="${next}"]`)?.focus();
  };
  const menuGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLButtonElement>('[data-mode-index]');
    const horizontal = ar ? -1 : 1;
    const offsets: Record<string, number> = { ArrowUp: -3, ArrowDown: 3, ArrowRight: horizontal, ArrowLeft: -horizontal };
    if (!target || !offsets[event.key]) return;
    event.preventDefault();
    moveHome(offsets[event.key]);
  };
  const panel = () => {
    switch (layer) {
      case 'home': return <><div className="cw-app-grid" onKeyDown={menuGridKey}>{MODES.map(({ id, icon: Icon, label }, index) => <button type="button" key={id} data-mode-index={index} aria-current={id === mode} className="cw-app-tile" onFocus={() => { homeCursor.current = index; }} onClick={() => selectMode(id)}>
        <Icon size={19} aria-hidden="true" /> <span>{t(label[0], label[1])}</span>
      </button>)}</div><p className="cw-help cw-menu-foot">{t('اختار وضع عشان تبدأ. حساباتك تفضل موجودة وإنت بتتنقل.', 'Choose an app to begin. Drafts stay in place while you switch apps.')}</p></>;
      case 'settings': return <div className="cw-mode-form">
        {!standard && <><div className="cw-form-grid"><CalcSelect label={t('وحدة الزوايا', 'Angle unit')} value={angle} set={pickAngle} items={[[ 'DEG', t('درجات · DEG', 'Degrees · DEG')], ['RAD', t('راديان · RAD', 'Radians · RAD')], ['GRAD', t('غراد · GRAD', 'Gradians · GRAD')]]} />
          <CalcSelect label={t('عرض الناتج', 'Output format')} value={effectiveFormat} set={(v) => setPrefs((current) => ({ ...current, format: v }))} items={availableFormats.map((v) => [v, t(...FORMAT_LABEL[v])])} /></div>
        <CalcSelect label={t('عدد المنازل لـ FIX / SCI / ENG', 'Digits for FIX / SCI / ENG')} value={String(precision)} set={(v) => setPrefs((current) => ({ ...current, precision: Number(v) }))} items={Array.from({ length: 13 }, (_, i) => [String(i), d(String(i))])} /></>}
        {standard && <p className="cw-help">{t('الحساب العادي بيعرض الناتج عشري. إعدادات الزوايا والكسور في الحساب العلمي.', 'Standard shows decimal results. Angle and fraction settings are in Scientific.')}</p>}
        <button type="button" className="cw-action" onClick={floating.reset}>{t('إرجاع النافذة لمكانها', 'Reset window position')}</button>
        <p className="cw-help">{t('الإعدادات والذاكرة محفوظة على الجهاز ده بس.', 'Settings and memories are stored on this device only.')}</p>
      </div>;
      case 'format': return <div className="cw-format-list">{availableFormats.map((choice) => <button className="cw-list-option" type="button" key={choice} aria-pressed={effectiveFormat === choice} onClick={() => pickFormat(choice)}><b dir="ltr">{FORMAT_TAG[choice]}</b><span>{t(...FORMAT_LABEL[choice])}</span>{effectiveFormat === choice && <Check size={15} />}</button>)}</div>;
      case 'catalog': return <><div className="cw-chip-list">{catalogTabs.map(({ id, label }) => <button type="button" key={id} aria-pressed={id === (catalogTabs.find((entry) => entry.id === catalog) ?? catalogTabs[0]).id} onClick={() => setCatalog(id)}>{t(label[0], label[1])}</button>)}</div>
        <div className="cw-catalog-list">{entries.map(({ label, expression, detail }) => <button type="button" key={expression} className="cw-list-option" onClick={() => { insert(expression); closeLayer(); }}><b dir="ltr">{label}</b><span>{detail ? t(...detail) : expression}</span><ArrowDownLeft size={14} aria-hidden="true" /></button>)}</div>
        <p className="cw-help cw-menu-foot">{t('الدوال بتفصل مدخلاتها بفاصلة. التفاضل والتكامل هنا عدديان.', 'Use commas between arguments. Integration and differentiation are numerical.')}</p></>;
      case 'variables': return <div className="cw-mode-form">
        <p className="cw-help">{t('خزّن آخر ناتج في متغير أو استدعِه للحساب.', 'Store the answer in a variable, or recall one into the expression.')}</p>
        <div className="cw-memory-grid" dir="ltr">{ENGINEERING_VARIABLES.map((key) => <div key={key} className="cw-memory-cell">
          <span className="cw-memory-name">{key}</span><span className="cw-mono cw-memory-value" title={copyableNumber(variables[key] ?? zero, false)}>{variables[key]?.im ? copyableNumber(variables[key]!, false) : displayNumber(variables[key]?.re ?? 0, currentLang)}</span>
          <button type="button" title={t(`استدعِ ${key}`, `Recall ${key}`)} aria-label={t(`استدعِ ${key}`, `Recall ${key}`)} onClick={() => { insert(key); closeLayer(); }}><ArrowDownLeft size={14} /></button>
          <button type="button" title={t(`خزّن في ${key}`, `Store in ${key}`)} aria-label={t(`خزّن في ${key}`, `Store in ${key}`)} disabled={!sheet.answer} onClick={() => variableSet(key, sheet.answer!)}><ArrowDownToLine size={14} /></button>
        </div>)}</div>
        <div className="cw-chip-list cw-inline-chips" dir="ltr">
          <button type="button" onClick={() => variableSet('A', zero)} title={t('امسح ذاكرة A', 'Clear memory A')}>MC</button>
          <button type="button" disabled={!sheet.answer} onClick={() => changeMemory('+')} title={t('أضف الناتج لذاكرة A', 'Add answer to memory A')}>M+</button>
          <button type="button" disabled={!sheet.answer} onClick={() => changeMemory('-')} title={t('اطرح الناتج من ذاكرة A', 'Subtract answer from memory A')}>M−</button>
        </div>
      </div>;
      case 'functions': return <div className="cw-mode-form">
        <p className="cw-help">{t('اكتب الدالتين باستخدام x؛ نفس الدوال متاحة في جدول الدوال.', 'Define functions of x; they are shared with the Table app.')}</p>
        {(['f', 'g'] as const).map((key) => <div className="cw-function-line" key={key}><CalcInput label={`${key}(x)`} value={functions[key] ?? ''} set={(value) => updateFunction(key, value)} placeholder={key === 'f' ? 'x^2' : '2*x+1'} /><button type="button" className="cw-tiny-button" disabled={!functions[key]?.trim()} onClick={() => { insert(`${key}(`); closeLayer(); }} aria-label={t(`أدخل ${key}(x)`, `Insert ${key}(x)`)}><ArrowDownLeft size={16} /></button></div>)}
        <button type="button" className="cw-action" onClick={() => openTool('table')}>{t('افتح جدول الدوال', 'Open Table')}<ArrowUpRight size={15} /></button>
      </div>;
      case 'tools': return <div className="cw-format-list">
        <button type="button" className="cw-list-option" disabled={!sheet.text.trim()} onClick={() => { setStudySeed((old) => ({ id: (old?.id ?? 0) + 1, text: sheet.text })); openTool('study'); }}><GraduationCap size={15} />{t('اتدرّب على التعبير ده', 'Study this expression')}</button>
        <button type="button" className="cw-list-option" onClick={() => showLayer('history')}><BookOpen size={15} />{t('سجل الحسابات', 'Calculation history')}</button>
        <button type="button" className="cw-list-option" disabled={!visibleResult} onClick={() => { void copy(); }}><Copy size={15} />{t('نسخ الناتج', 'Copy result')}</button>
        <button type="button" className="cw-list-option" disabled={!visibleResult || Boolean(visibleResult.im) || !Number.isInteger(visibleResult.re) || visibleResult.re < 2 || visibleResult.re > 1e12} onClick={primeFactors}><Variable size={15} />{t('التحليل لعوامل أولية', 'Prime factorization')}</button>
        <button type="button" className="cw-list-option" onClick={() => openTool('units')}><ArrowUpRight size={15} />{t('تحويل الوحدات', 'Unit conversion')}</button>
      </div>;
      case 'history': return <div className="cw-format-list">{sheet.history.length ? sheet.history.map((row, i) => <button key={i} className="cw-list-option cw-history-row" type="button" onClick={() => selectHistory(i)}>
        <span dir="ltr" className="cw-mono">{row.text}</span><b dir="ltr" className="cw-mono">{row.result.im ? copyableNumber(row.result, false) : displayNumber(row.result.re, currentLang)}</b>
      </button>) : <p className="cw-help cw-menu-foot">{standard ? t('السجل لسه فاضي. اضغط = عشان تحفظ الحساب.', 'No history yet. Press = to save your calculation.') : t('السجل لسه فاضي. اضغط EXE عشان تحفظ الحساب.', 'No history yet. Press EXE to save your calculation.')}</p>}</div>;
      default: return null;
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(<>
    {minimized && <div className="cw-dock" data-behind-modal={behindModal} dir={ar ? 'rtl' : 'ltr'} id={ENGINEERING_WINDOW_ID}>
      <button type="button" ref={floating.restoreRef} onClick={onRestore} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}><Calculator size={17} aria-hidden="true" />{t('استعادة الحاسبة', 'Restore calculator')}</button>
      <button type="button" onClick={onClose} aria-label={t('إغلاق الحاسبة', 'Close calculator')}><X size={16} /></button>
    </div>}
    <section id={minimized ? undefined : ENGINEERING_WINDOW_ID} hidden={minimized} role="dialog" aria-labelledby={titleId} className="cw-window" data-behind-modal={behindModal} data-positioned={Boolean(floating.position)} data-dragging={floating.dragging}
      ref={floating.windowRef} style={floating.position} tabIndex={-1} dir={ar ? 'rtl' : 'ltr'} onKeyDown={shortcut}>
      <header className="cw-titlebar" onPointerDown={floating.pointerDown} onPointerMove={floating.pointerMove} onPointerUp={floating.pointerEnd} onPointerCancel={floating.pointerEnd} onLostPointerCapture={floating.pointerEnd}>
        <button type="button" data-cw-grip aria-label={t('تحريك النافذة بمفاتيح الأسهم', 'Move window with arrow keys')} title={t('اسحب للتحريك · الأسهم من لوحة المفاتيح', 'Drag to move · arrow keys when focused')} onKeyDown={floating.gripKey}><GripVertical size={17} /></button>
        <h2 id={titleId}>{t('الحاسبة الهندسية', 'Engineering calculator')}</h2>
        <button type="button" className="cw-title-control" onClick={onMinimize} aria-label={t('تصغير الحاسبة', 'Minimize calculator')} title={t('تصغير', 'Minimize')}><Minus size={16} /></button>
        <button type="button" className="cw-title-control cw-close" onClick={onClose} aria-label={t('إغلاق الحاسبة', 'Close calculator')} title={t('إغلاق', 'Close')}><X size={16} /></button>
      </header>
      <div className="cw-body">
        <div className="cw-brand" dir="ltr"><div><b>SHAM</b><span>SCIENTIFIC SERIES</span></div><span className="cw-edition">MATH <span> / </span>{d('03')}</span></div>
        {!layer && (standard || mode === 'calculate') && <div className="cw-mode-switch" role="group" aria-label={t('طريقة الحساب', 'Calculation mode')}>
          <button type="button" aria-pressed={standard} onClick={() => { if (!standard) selectMode('standard'); }}>{t('حساب عادي', 'Standard')}</button>
          <button type="button" aria-pressed={!standard} onClick={() => { if (standard) selectMode('calculate'); }}>{t('حساب علمي', 'Scientific')}</button>
        </div>}
        <div className="cw-bezel">
          <div className="cw-lcd">
            <div className="cw-indicators"><span><KeyIcon size={13} aria-hidden="true" />{layer ? t(...layerTitle[layer]) : modeLabel}</span><div dir="ltr">{standard ? <b>SEQ</b> : <><b data-on={shift}>SHIFT</b><b>{angle}</b></>}<b>{FORMAT_TAG[effectiveFormat]}</b></div></div>
            {!layer && isWorksheet(mode) ? <>
              <label htmlFor={expressionId} className="cw-sr-only">{t('التعبير الرياضي', 'Math expression')}</label>
              <input id={expressionId} className="cw-expression cw-mono" dir="ltr" value={sheet.text} ref={expressionRef} onSelect={rememberCursor} onClick={rememberCursor} onKeyUp={rememberCursor}
                onChange={(event) => edit(event.target.value, event.target.selectionStart ?? event.target.value.length)} maxLength={ENGINEERING_EXPRESSION_LIMIT} autoComplete="off" spellCheck={false} placeholder={standard ? d('77 − 15 ÷ 100') : mode === 'complex' ? d('(2+3i) × (1−i)') : d('sin(30) + √(16)')} />
              <div className="cw-lcd-bottom">
                {preview?.status === 'value' && <span className="cw-lcd-live">{preview.subtotal ? t('ناتج مرحلي', 'SUBTOTAL') : t('ناتج فوري', 'LIVE')}</span>}
                <output aria-live="polite" data-testid="engineering-calculator-result" className="cw-result cw-mono" dir="ltr">
                  {errorText ? <span dir="auto" className="cw-lcd-error">{errorText}</span>
                    : readout ? <><LCDValue value={readout} />
                      {decimalEquivalent && <span className="cw-result-equivalent">= {decimalEquivalent}</span>}</>
                      : preview?.status === 'manual' ? <span dir="auto" className="cw-lcd-hint">{t('اضغط EXE للتنفيذ', 'Press EXE to run')}</span>
                        : !sheet.text.trim() ? d('0') : '—'}
                </output>
                {visibleResult && <button className="cw-lcd-copy" type="button" onClick={() => { void copy(); }} aria-label={t('نسخ الناتج', 'Copy result')} title={t('نسخ الناتج', 'Copy result')}><Copy size={15} /></button>}
              </div>
              {standard && <small className="cw-standard-hint">{t('الحساب حسب ترتيب الضغط', 'Calculates in key-entry order')}</small>}
            </> : <div className="cw-lcd-message">
              <span>{layer ? t(...layerTitle[layer]) : modeLabel}</span>
              <small>{layer === 'home' ? t('اختار التطبيق اللي محتاجه', 'Select a calculator app') : layer ? t('حساب محلي على جهازك', 'Runs locally on your device') : t(active.note[0], active.note[1])}</small>
            </div>}
          </div>
        </div>
        <div className="cw-console" dir="ltr">
          <div className="cw-system">
            <Key label={t('أوضاع الحاسبة', 'Calculator apps')} cap="HOME" click={() => showLayer('home')} pressed={layer === 'home'}><House size={16} /></Key>
            <Key label={t('الإعدادات', 'Settings')} cap="SET UP" click={() => showLayer('settings')} pressed={layer === 'settings'}><Settings2 size={16} /></Key>
            <Key label={t('رجوع', 'Back')} cap="BACK" click={back}><ArrowLeft size={16} /></Key>
            <Key label={t('تراجع عن الكتابة', 'Undo entry')} cap="UNDO" disabled={!isWorksheet(mode) || Boolean(layer) || !undoStack.current[worksheetMode].length} click={undo}><Undo2 size={16} /></Key>
          </div>
          <div className="cw-dpad" aria-label={t('مفاتيح الاتجاهات', 'Directional keys')}>
            <Key label={t('لأعلى', 'Up')} className="cw-up" disabled={layer !== 'home' && (!isWorksheet(mode) || Boolean(layer) || !sheet.history.length)} click={() => layer === 'home' ? moveHome(-3) : replay(1)}><ChevronUp size={17} /></Key>
            <Key label={t('المؤشر لليسار', 'Cursor left')} className="cw-left" disabled={layer !== 'home' && (!isWorksheet(mode) || Boolean(layer))} click={() => layer === 'home' ? moveHome(ar ? 1 : -1) : moveCursor(-1)}><ChevronLeft size={17} /></Key>
            <Key label={t('موافق', 'OK')} className="cw-ok" click={() => {
              if (layer === 'home') selectMode(MODES[homeCursor.current].id);
              else if (layer) closeLayer();
              else if (isWorksheet(mode)) exe();
              else if (mode === 'spreadsheet') floating.windowRef.current?.querySelector<HTMLInputElement>('.cw-app:not([hidden]) input')?.focus();
              else Array.from(floating.windowRef.current?.querySelectorAll<HTMLButtonElement>('.cw-app:not([hidden]) button[type="submit"]') ?? []).find((button) => !button.closest('[hidden]'))?.click();
            }}>OK</Key>
            <Key label={t('المؤشر لليمين', 'Cursor right')} className="cw-right" disabled={layer !== 'home' && (!isWorksheet(mode) || Boolean(layer))} click={() => layer === 'home' ? moveHome(ar ? -1 : 1) : moveCursor(1)}><ChevronRight size={17} /></Key>
            <Key label={t('لأسفل', 'Down')} className="cw-down" disabled={layer !== 'home' && (!isWorksheet(mode) || Boolean(layer) || !sheet.history.length)} click={() => layer === 'home' ? moveHome(3) : replay(-1)}><ChevronDown size={17} /></Key>
          </div>
          <div className="cw-replay">
            <Key label={t('الحساب السابق', 'Previous calculation')} disabled={!isWorksheet(mode) || Boolean(layer) || !sheet.history.length} click={() => replay(1)}><ChevronsUp size={16} /></Key>
            <span>REPLAY</span>
            <Key label={t('الحساب التالي', 'Next calculation')} disabled={!isWorksheet(mode) || Boolean(layer) || sheet.replay === undefined} click={() => replay(-1)}><ChevronsDown size={16} /></Key>
          </div>
        </div>
        {isWorksheet(mode) && !standard && <div className="cw-quick" dir="ltr">
          <Key label="Shift" className="cw-shift" click={() => { if (layer) closeLayer(); setShift(!shift); }} pressed={shift}>SHIFT</Key>
          <Key label={t('ذاكرة المتغيرات', 'Variable memory')} click={() => showLayer('variables')} pressed={layer === 'variables'}>VAR</Key>
          <Key label={t('ذاكرة الدوال', 'Function memory')} click={() => showLayer('functions')} pressed={layer === 'functions'}><FunctionSquare size={16} /></Key>
          <Key label={t('دليل الدوال', 'Function catalog')} click={() => showLayer('catalog')} pressed={layer === 'catalog'}>CATALOG</Key>
          <Key label={t('أدوات الحساب', 'Calculation tools')} click={() => showLayer('tools')} pressed={layer === 'tools'}><Ellipsis size={19} /></Key>
        </div>}
        {!layer && isWorksheet(mode) && !standard && <button type="button" className="cw-study-shortcut" onClick={() => openTool('study')}><GraduationCap size={16} />{t('ذاكر مع شاهين', 'Study with Shaheen')}<ArrowUpRight size={13} /></button>}
        {layer && <div className="cw-panel" ref={menuRef}>{panel()}</div>}
        {!layer && isWorksheet(mode) && <div className="cw-deck">{standard ? renderKeys(STANDARD_KEYS, 'standard-keys')
          : <>{renderKeys(FUNCTION_KEYS, 'functions')}{renderKeys(NUMBER_KEYS, 'numbers')}</>}</div>}
        <CalculatorModes lang={currentLang} t={t} studySeed={studySeed} current={layer ? null : mode} visited={visited} options={evalOptions} functions={functions} updateFunction={updateFunction} />
        <footer className="cw-footer"><span>{t('حساب محلي', 'LOCAL COMPUTE')}</span><span role="status" dir="auto">{notice || (layer === 'home' ? `${d(String(MODES.length))} ${t('وضع', 'APPS')}` : t('HOME للأوضاع', 'HOME FOR APPS'))}</span></footer>
      </div>
    </section>
  </>, document.body);
}

export default EngineeringCalculator;
