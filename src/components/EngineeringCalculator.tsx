import { useEffect, useMemo, useState } from 'react';
import { Calculator, Check, ChevronDown, Copy, RotateCcw, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import {
  convertEngineeringUnit,
  ENGINEERING_UNITS,
  evaluateEngineeringExpression,
  type AngleMode,
  type EngineeringUnitCategory,
} from '../utils/engineeringCalculator';

const CATEGORIES = Object.keys(ENGINEERING_UNITS) as EngineeringUnitCategory[];
const CATEGORY_NAMES: Record<EngineeringUnitCategory, [string, string]> = {
  length: ['طول', 'Length'], area: ['مساحة', 'Area'], volume: ['حجم', 'Volume'], mass: ['كتلة', 'Mass'],
  temperature: ['حرارة', 'Temperature'], pressure: ['ضغط', 'Pressure'], speed: ['سرعة', 'Speed'],
  energy: ['طاقة', 'Energy'], power: ['قدرة', 'Power'], voltage: ['جهد كهربائي', 'Voltage'],
  current: ['تيار كهربائي', 'Current'], resistance: ['مقاومة', 'Resistance'], frequency: ['تردد', 'Frequency'],
};

function formatResult(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 12, useGrouping: false }).format(value);
}

function GlassSelect({ value, onChange, values, label, renderItem }: { value: string; onChange: (value: string) => void; values: readonly string[]; label: string; renderItem?: (value: string) => string }) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="w-full appearance-none rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 pe-9 text-sm text-white outline-none transition focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20">
        {values.map((item) => <option key={item} value={item} className="bg-slate-900 text-white">{renderItem ? renderItem(item) : item}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true" />
    </label>
  );
}

export function EngineeringCalculator({ currentLang, onClose }: { currentLang: SupportedLanguage; onClose: () => void }) {
  const isArabic = currentLang === 'ar';
  const say = (ar: string, en: string) => isArabic ? ar : en;
  const [panel, setPanel] = useState<'scientific' | 'convert'>('scientific');
  const [expression, setExpression] = useState('');
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [answer, setAnswer] = useState<number | undefined>();
  const [memory, setMemory] = useState(0);
  const [copied, setCopied] = useState(false);
  const [category, setCategory] = useState<EngineeringUnitCategory>('length');
  const [fromUnit, setFromUnit] = useState(ENGINEERING_UNITS.length[0]);
  const [toUnit, setToUnit] = useState(ENGINEERING_UNITS.length[1]);
  const [convertValue, setConvertValue] = useState('1');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const calculation = useMemo(() => {
    if (!expression.trim()) return { value: undefined as number | undefined, error: '' };
    try { return { value: evaluateEngineeringExpression(expression, { angleMode, answer }), error: '' }; }
    catch (error) { return { value: undefined, error: error instanceof Error ? error.message : say('تعبير غير صالح', 'Invalid expression') }; }
  }, [expression, angleMode, answer]);

  const conversion = useMemo(() => {
    if (!convertValue.trim()) return { value: undefined as number | undefined, error: '' };
    const numeric = Number(convertValue);
    if (!Number.isFinite(numeric)) return { value: undefined, error: say('أدخل رقمًا صالحًا', 'Enter a valid number') };
    try { return { value: convertEngineeringUnit(numeric, category, fromUnit, toUnit), error: '' }; }
    catch { return { value: undefined, error: say('تعذر التحويل بين الوحدتين', 'These units cannot be converted') }; }
  }, [convertValue, category, fromUnit, toUnit, isArabic]);

  const updateCategory = (next: EngineeringUnitCategory) => {
    const units = ENGINEERING_UNITS[next];
    setCategory(next);
    setFromUnit(units[0]);
    setToUnit(units[1] || units[0]);
  };
  const insert = (text: string) => setExpression((current) => current + text);
  const currentValue = calculation.value;
  const equals = () => {
    if (currentValue === undefined) return;
    setAnswer(currentValue);
    setExpression(formatResult(currentValue));
  };
  const copyResult = async () => {
    if (currentValue === undefined) return;
    try {
      await navigator.clipboard.writeText(formatResult(currentValue));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  };

  const keys: { label: string; value?: string; action?: () => void; tone?: 'accent' | 'operator' | 'equals' }[] = [
    { label: 'MC', action: () => setMemory(0), tone: 'operator' },
    { label: 'MR', action: () => insert(formatResult(memory)), tone: 'operator' },
    { label: 'M+', action: () => { if (currentValue !== undefined) setMemory((old) => old + currentValue); }, tone: 'operator' },
    { label: 'M−', action: () => { if (currentValue !== undefined) setMemory((old) => old - currentValue); }, tone: 'operator' },
    { label: 'AC', action: () => setExpression(''), tone: 'accent' },
    { label: '(', value: '(' }, { label: ')', value: ')' }, { label: 'mod', value: ' mod ', tone: 'operator' },
    { label: '÷', value: '÷', tone: 'operator' }, { label: '⌫', action: () => setExpression((old) => old.slice(0, -1)), tone: 'operator' },
    { label: 'sin', value: 'sin(', tone: 'operator' }, { label: 'cos', value: 'cos(', tone: 'operator' },
    { label: 'tan', value: 'tan(', tone: 'operator' }, { label: '√', value: 'sqrt(', tone: 'operator' }, { label: 'x²', value: '^2', tone: 'operator' },
    { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' }, { label: '×', value: '×', tone: 'operator' }, { label: 'xʸ', value: '^', tone: 'operator' },
    { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' }, { label: '−', value: '−', tone: 'operator' }, { label: 'π', value: 'pi', tone: 'operator' },
    { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '+', value: '+', tone: 'operator' }, { label: 'e', value: 'e', tone: 'operator' },
    { label: '±', action: () => setExpression((old) => old ? `-(${old})` : '-'), tone: 'operator' }, { label: '0', value: '0' },
    { label: '.', value: '.' }, { label: '!', value: '!', tone: 'operator' }, { label: '=', action: equals, tone: 'equals' },
    { label: 'ln', value: 'ln(', tone: 'operator' }, { label: 'log', value: 'log(', tone: 'operator' },
    { label: 'Ans', value: answer === undefined ? 'ans' : formatResult(answer), tone: 'operator' },
    { label: '%', value: '%', tone: 'operator' }, { label: angleMode, action: () => setAngleMode((old) => old === 'DEG' ? 'RAD' : 'DEG'), tone: 'accent' },
    { label: 'asin', value: 'asin(', tone: 'operator' }, { label: 'acos', value: 'acos(', tone: 'operator' }, { label: 'atan', value: 'atan(', tone: 'operator' }, { label: 'sinh', value: 'sinh(', tone: 'operator' }, { label: 'cosh', value: 'cosh(', tone: 'operator' },
    { label: 'tanh', value: 'tanh(', tone: 'operator' }, { label: 'abs', value: 'abs(', tone: 'operator' }, { label: 'exp', value: 'exp(', tone: 'operator' }, { label: 'cbrt', value: 'cbrt(', tone: 'operator' }, { label: ',', value: ',', tone: 'operator' },
    { label: 'root', value: 'root(', tone: 'operator' }, { label: 'nCr', value: 'nCr(', tone: 'operator' }, { label: 'nPr', value: 'nPr(', tone: 'operator' }, { label: 'hypot', value: 'hypot(', tone: 'operator' }, { label: 'g', value: 'g', tone: 'operator' },
  ];

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/75 p-3 backdrop-blur-md sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="engineering-calculator-title" className="relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-white/20 bg-[linear-gradient(145deg,rgba(148,163,184,0.22),rgba(15,23,42,0.92)_32%,rgba(30,41,59,0.86)_72%,rgba(245,158,11,0.12))] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_38%)]" />
        <div className="relative z-10">
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-200/25 bg-amber-200/10 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"><Calculator className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h2 id="engineering-calculator-title" className="text-lg font-bold sm:text-xl">{say('الحاسبة الهندسية', 'Engineering calculator')}</h2>
                <p className="mt-0.5 text-xs text-slate-300">{say('علمية، ذاكرة، وتحويل وحدات هندسية', 'Scientific math, memory, and engineering unit conversion')}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label={say('إغلاق الحاسبة', 'Close calculator')} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/15"><X className="h-5 w-5" /></button>
          </header>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
            <button type="button" onClick={() => setPanel('scientific')} aria-pressed={panel === 'scientific'} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${panel === 'scientific' ? 'bg-white/15 text-white shadow-inner' : 'text-slate-400 hover:text-white'}`}>{say('حاسبة علمية', 'Scientific')}</button>
            <button type="button" onClick={() => setPanel('convert')} aria-pressed={panel === 'convert'} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${panel === 'convert' ? 'bg-white/15 text-white shadow-inner' : 'text-slate-400 hover:text-white'}`}>{say('تحويل هندسي', 'Unit converter')}</button>
          </div>

          {panel === 'scientific' ? (
            <div className="mt-4">
              <div className="rounded-2xl border border-white/15 bg-slate-950/55 p-3 shadow-[inset_0_1px_12px_rgba(255,255,255,0.04)] sm:p-4">
                <label htmlFor="engineering-expression" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{say('التعبير الرياضي', 'Expression')}</label>
                <input id="engineering-expression" value={expression} onChange={(event) => setExpression(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); equals(); } }} dir="ltr" autoComplete="off" spellCheck={false} placeholder="sin(30) + sqrt(16)" className="w-full bg-transparent text-right font-mono text-lg text-white outline-none placeholder:text-slate-600 sm:text-2xl" />
                <div className="mt-3 flex min-h-12 items-end justify-between gap-2 border-t border-white/10 pt-2">
                  <p aria-live="polite" className="min-w-0 break-all font-mono text-2xl font-bold tabular-nums text-amber-200 sm:text-3xl">{currentValue === undefined ? '—' : formatResult(currentValue)}</p>
                  <button type="button" onClick={() => { void copyResult(); }} disabled={currentValue === undefined} aria-label={say('نسخ الناتج', 'Copy result')} className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40">{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}</button>
                </div>
                {calculation.error && expression.trim() && <p role="status" className="mt-1 text-[11px] text-rose-300">{calculation.error}</p>}
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>{say('الذاكرة', 'Memory')}: <b className="font-mono text-slate-200">{formatResult(memory)}</b></span><span>{say('الزوايا', 'Angles')}: {angleMode}</span></div>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
                {keys.map((key, index) => <button key={`${key.label}-${index}`} type="button" onClick={key.action || (() => insert(key.value || ''))} className={`min-h-10 rounded-xl border px-1 text-sm font-semibold transition active:scale-[0.97] sm:min-h-12 sm:text-base ${key.tone === 'equals' ? 'border-amber-200/40 bg-amber-300 text-slate-950 hover:bg-amber-200' : key.tone === 'accent' ? 'border-amber-200/20 bg-amber-200/10 text-amber-100 hover:bg-amber-200/20' : key.tone === 'operator' ? 'border-white/10 bg-white/[0.08] text-sky-100 hover:bg-white/[0.15]' : 'border-white/[0.08] bg-slate-950/35 text-white hover:bg-white/[0.12]'}`}>{key.label}</button>)}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-400">{say('الدوال: sin cos tan، الدوال العكسية والزائدية، ln/log، الجذور، nCr/nPr، min/max، والثوابت π وe وc وg وR وNA وh. استخدم الأقواس للدوال.', 'Functions: trig, inverse and hyperbolic trig, ln/log, roots, nCr/nPr, min/max, and constants π, e, c, g, R, NA and h. Put function inputs in parentheses.')}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/15 bg-slate-950/45 p-4 sm:p-5">
              <label className="mb-2 block text-xs font-semibold text-slate-300">{say('نوع القياس', 'Measurement')}</label>
              <GlassSelect value={category} onChange={(value) => updateCategory(value as EngineeringUnitCategory)} values={CATEGORIES} label={say('نوع القياس', 'Measurement')} renderItem={(value) => CATEGORY_NAMES[value as EngineeringUnitCategory][isArabic ? 0 : 1]} />
              <label htmlFor="engineering-convert-value" className="mb-2 mt-4 block text-xs font-semibold text-slate-300">{say('القيمة', 'Value')}</label>
              <input id="engineering-convert-value" inputMode="decimal" value={convertValue} onChange={(event) => setConvertValue(event.target.value)} dir="ltr" className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-3 font-mono text-lg text-white outline-none focus:border-amber-300/70" />
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div><label className="mb-2 block text-xs font-semibold text-slate-300">{say('من', 'From')}</label><GlassSelect value={fromUnit} onChange={setFromUnit} values={ENGINEERING_UNITS[category]} label={say('الوحدة الأصلية', 'Source unit')} /></div>
                <RotateCcw className="mb-3 h-4 w-4 text-amber-200/70" aria-hidden="true" />
                <div><label className="mb-2 block text-xs font-semibold text-slate-300">{say('إلى', 'To')}</label><GlassSelect value={toUnit} onChange={setToUnit} values={ENGINEERING_UNITS[category]} label={say('الوحدة المطلوبة', 'Target unit')} /></div>
              </div>
              <div className="mt-4 rounded-xl border border-amber-200/20 bg-amber-100/[0.08] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-100/70">{say('الناتج', 'Result')}</p>
                <p aria-live="polite" className="mt-1 break-all font-mono text-2xl font-bold tabular-nums text-amber-100">{conversion.value === undefined ? '—' : formatResult(conversion.value)} <span className="text-sm">{toUnit}</span></p>
                {conversion.error && <p role="status" className="mt-1 text-xs text-rose-300">{conversion.error}</p>}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-400">{say('تحويلات قياسية للأطوال والمساحات والحجوم والكتلة والحرارة والضغط والسرعة والطاقة والقدرة والكهرباء والتردد.', 'Standard conversions for length, area, volume, mass, temperature, pressure, speed, energy, power, electricity and frequency.')}</p>
            </div>
          )}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><Calculator className="h-3 w-3" aria-hidden="true" />{say('للحسابات العلمية والهندسية العامة؛ تحقّق من الوحدات والنتائج الحرجة.', 'For general scientific and engineering calculations; verify units and safety-critical results.')}</p>
        </div>
      </section>
    </div>
  );
}
