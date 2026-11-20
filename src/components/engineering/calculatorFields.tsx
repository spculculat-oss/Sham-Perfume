import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react';
import type { SupportedLanguage } from '../../types/i18n';
import { ENGINEERING_EXPRESSION_LIMIT, evaluateEngineeringExpression, type EngineeringFunctions, type EvaluateOptions } from '../../utils/engineeringCalculator';
import { displayNumber, type CalcText } from './calculatorDisplay';

export interface ModeProps {
  lang: SupportedLanguage;
  t: CalcText;
  options: EvaluateOptions;
  functions: EngineeringFunctions;
  updateFunction: (key: 'f' | 'g', body: string) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="cw-field"><span>{label}</span>{children}</label>;
}
export function CalcInput({ label, value, set, placeholder, area = false, max = ENGINEERING_EXPRESSION_LIMIT }: { label: string; value: string; set: (next: string) => void; placeholder?: string; area?: boolean; max?: number }) {
  const common = { value, placeholder, dir: 'ltr', maxLength: max, spellCheck: false, autoComplete: 'off', className: 'cw-control cw-mono' } as const;
  return <Field label={label}>{area ? <textarea {...common} rows={3} onChange={(e) => set(e.target.value)} /> : <input {...common} onChange={(e) => set(e.target.value)} />}</Field>;
}

export function CalcSelect<T extends string>({ label, value, set, items, ltr }: { label: string; value: T; set: (next: T) => void; items: ReadonlyArray<readonly [T, string]>; ltr?: boolean }) {
  return <Field label={label}><select className="cw-control" dir={ltr ? 'ltr' : undefined} value={value} onChange={(e) => set(e.target.value as T)}>{items.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>;
}

export function ResultTable({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return <div className="cw-table-wrap" dir="ltr"><table className="cw-table"><thead><tr>{headers.map((label, i) => <th key={i} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td className="cw-mono" key={j}>{value}</td>)}</tr>)}</tbody></table></div>;
}

export function DataList({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return <dl className="cw-data-list">{rows.map(([key, value], index) => <div key={index}><dt>{key}</dt><dd dir="ltr" className="cw-mono">{value}</dd></div>)}</dl>;
}

export const CalculatorModeRevision = createContext<unknown>(undefined);

export function ModeForm({ t, children, run, action, note, revision }: { t: CalcText; children: ReactNode; run: () => ReactNode; action?: string; note?: string; revision?: unknown }) {
  const scope = useContext(CalculatorModeRevision);
  const [outcome, setOutcome] = useState<{ result?: ReactNode; error?: Error; revision: unknown; scope: unknown }>();
  const execute = (e: FormEvent) => {
    e.preventDefault();
    try { setOutcome({ result: run(), revision, scope }); }
    catch (error) { setOutcome({ error: error instanceof Error ? error : new Error('Check the input.'), revision, scope }); }
  };
  const current = outcome?.revision === revision && outcome?.scope === scope ? outcome : undefined;
  return <><form onSubmit={execute} onChange={() => { if (outcome) setOutcome(undefined); }} className="cw-mode-form">
    {children}
    {note && <p className="cw-help">{note}</p>}
    <button type="submit" className="cw-action">{action ?? t('احسب', 'Calculate')} <span dir="ltr">EXE</span></button>
  </form>
    {current?.error && <p role="alert" className="cw-form-error cw-after-form">{t('راجع القيم والصيغة المطلوبة.', current.error.message)}</p>}
    {current?.result !== undefined && <><p className="cw-sr-only" role="status">{t('نتيجة الحساب جاهزة', 'Calculation result ready')}</p><div className="cw-mode-output cw-after-form">{current.result}</div></>}
  </>;
}

export const num = (text: string, props: ModeProps) => evaluateEngineeringExpression(text, props.options);
export const nfmt = (value: number, props: ModeProps) => displayNumber(value, props.lang);
export const optionsFor = <T extends string>(items: Record<T, [string, string]>, t: CalcText) => (Object.keys(items) as T[]).map((key) => [key, t(items[key][0], items[key][1])] as const);
