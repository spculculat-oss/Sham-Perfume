import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeftRight, BarChart3, Calculator, ChartSpline, Dice5, Equal, FunctionSquare, Grid2x2, Hash, MoveUpRight, Percent, Sheet, Sigma, Table2 } from 'lucide-react';
import type { SupportedLanguage } from '../../types/i18n';
import { toLatinDigits } from '../../لغات/numerals';
import {
  convertEngineeringUnit, ENGINEERING_EXPRESSION_LIMIT, ENGINEERING_UNITS, evaluateEngineeringExpression,
  type EngineeringFunctions, type EngineeringUnitCategory, type EvaluateOptions,
} from '../../utils/engineeringCalculator';
import {
  calculateBaseN, calculateMatrix, calculateVector, engineeringTable, identityMatrix, simulateMathBox,
  solveLinearSystem, solveNumericEquation, solvePolynomial, solvePolynomialInequality, solveRatio,
  type BaseOperation, type InequalityOperator, type MatrixOperation, type Radix, type VectorOperation,
} from '../../utils/engineeringAdvanced';
import { binomialProbability, fitRegression, inverseNormal, normalDensity, normalProbability, poissonProbability, summarizeStatistics, type RegressionKind } from '../../utils/engineeringStatistics';
import { evaluateEngineeringSheet, SHEET_CELL_LENGTH, SHEET_CELL_LIMIT, SHEET_COLUMNS, SHEET_ROWS } from '../../utils/engineeringSpreadsheet';
import { displayDigits, displayNumber, formatComplex, type CalcText } from './calculatorDisplay';

export const MODES = [
  { id: 'calculate', icon: Calculator, label: ['حساب علمي', 'Calculate'], note: ['عمليات علمية وكسور وتفاضل وتكامل', 'Scientific expressions, fractions and calculus'] },
  { id: 'statistics', icon: BarChart3, label: ['إحصاء', 'Statistics'], note: ['وصف البيانات والانحدار', 'Descriptive statistics and regression'] },
  { id: 'distribution', icon: ChartSpline, label: ['توزيعات', 'Distribution'], note: ['طبيعي، ثنائي الحدين، وبواسون', 'Normal, binomial and Poisson'] },
  { id: 'spreadsheet', icon: Sheet, label: ['جدول بيانات', 'Spreadsheet'], note: ['خمس أعمدة وصيغ تربط الخلايا', 'Five columns and cell formulas'] },
  { id: 'table', icon: Table2, label: ['جدول الدوال', 'Table'], note: ['احسب قيم دالة أو دالتين في نطاق', 'Sample one or two functions over a range'] },
  { id: 'equation', icon: Equal, label: ['معادلات', 'Equation'], note: ['متعددة الحدود، أنظمة وحل عددي', 'Polynomials, systems and numerical solver'] },
  { id: 'inequality', icon: FunctionSquare, label: ['متباينات', 'Inequality'], note: ['فترات حل حتى الدرجة الرابعة', 'Solution intervals through degree four'] },
  { id: 'complex', icon: Sigma, label: ['أعداد مركبة', 'Complex'], note: ['الصيغة الجبرية والقطبية', 'Rectangular and polar form'] },
  { id: 'base', icon: Hash, label: ['أنظمة الأعداد', 'Base-N'], note: ['ثنائي، ثماني، عشري، وست عشري', 'Binary, octal, decimal and hexadecimal'] },
  { id: 'matrix', icon: Grid2x2, label: ['مصفوفات', 'Matrix'], note: ['عمليات حتى ٤ × ٤', 'Matrix arithmetic up to 4 × 4'] },
  { id: 'vector', icon: MoveUpRight, label: ['متجهات', 'Vector'], note: ['متجهات في بعدين أو ثلاثة', 'Two- and three-dimensional vectors'] },
  { id: 'ratio', icon: Percent, label: ['تناسب', 'Ratio'], note: ['أوجد الحد المجهول في التناسب', 'Find an unknown term in a proportion'] },
  { id: 'mathbox', icon: Dice5, label: ['Math Box', 'Math Box'], note: ['تجارب النرد والعملات', 'Dice and coin experiments'] },
  { id: 'units', icon: ArrowLeftRight, label: ['تحويل الوحدات', 'Unit conversion'], note: ['الطول والحرارة والطاقة وغيرها', 'Length, temperature, energy and more'] },
] as const;

export type CalcMode = typeof MODES[number]['id'];
export type ToolMode = Exclude<CalcMode, 'calculate' | 'complex'>;
interface ModeProps {
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

function ResultTable({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return <div className="cw-table-wrap" dir="ltr"><table className="cw-table"><thead><tr>{headers.map((label, i) => <th key={i} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td className="cw-mono" key={j}>{value}</td>)}</tr>)}</tbody></table></div>;
}

function DataList({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return <dl className="cw-data-list">{rows.map(([key, value], index) => <div key={index}><dt>{key}</dt><dd dir="ltr" className="cw-mono">{value}</dd></div>)}</dl>;
}

function ModeForm({ t, children, run, action, note, revision }: { t: CalcText; children: ReactNode; run: () => ReactNode; action?: string; note?: string; revision?: unknown }) {
  const [outcome, setOutcome] = useState<{ result?: ReactNode; error?: Error; revision: unknown }>();
  const execute = (e: FormEvent) => {
    e.preventDefault();
    try { setOutcome({ result: run(), revision }); }
    catch (error) { setOutcome({ error: error instanceof Error ? error : new Error('Check the input.'), revision }); }
  };
  const current = outcome?.revision === revision ? outcome : undefined;
  return <form onSubmit={execute} onChange={() => { if (outcome) setOutcome(undefined); }} className="cw-mode-form">
    {children}
    {note && <p className="cw-help">{note}</p>}
    <button type="submit" className="cw-action">{action ?? t('احسب', 'Calculate')} <span dir="ltr">EXE</span></button>
    {current?.error && <p role="alert" className="cw-form-error">{t('راجع القيم والصيغة المطلوبة.', current.error.message)}</p>}
    {current?.result !== undefined && <div className="cw-mode-output" role="status">{current.result}</div>}
  </form>;
}

const num = (text: string, props: ModeProps) => evaluateEngineeringExpression(text, props.options);
const nfmt = (value: number, props: ModeProps) => displayNumber(value, props.lang);
const numericList = (text: string, props: ModeProps) => text.trim().split(/[\s,،;؛]+/).map((item) => num(item, props));
const numericRows = (text: string, props: ModeProps) => text.trim().split(/[\n;؛]+/).filter((row) => row.trim()).map((row) => numericList(row, props));
const optionsFor = <T extends string>(items: Record<T, [string, string]>, t: CalcText) => (Object.keys(items) as T[]).map((key) => [key, t(items[key][0], items[key][1])] as const);

const MATRIX_OPERATIONS: Record<MatrixOperation, [string, string]> = {
  add: ['A + B', 'A + B'], subtract: ['A − B', 'A − B'], multiply: ['A × B', 'A × B'], det: ['المحدِّد det(A)', 'Determinant det(A)'],
  inverse: ['المعكوس A⁻¹', 'Inverse A⁻¹'], transpose: ['المنقول Aᵀ', 'Transpose Aᵀ'], identity: ['مصفوفة الوحدة I', 'Identity I'],
};
function MatrixMode(props: ModeProps) {
  const { t, options } = props;
  const [op, setOp] = useState<MatrixOperation>('multiply');
  const [a, setA] = useState('1 2\n3 4');
  const [b, setB] = useState('2 0\n0 2');
  const [size, setSize] = useState('2');
  return <ModeForm t={t} revision={options.angleMode} note={t('اكتب كل صف في سطر، وافصل الأعداد بمسافات: حتى ٤ × ٤.', 'Use one row per line and separate values with spaces (up to 4 × 4).')} run={() => {
    const result = op === 'identity' ? identityMatrix(num(size, props)) : calculateMatrix(op, numericRows(a, props), ['add', 'subtract', 'multiply'].includes(op) ? numericRows(b, props) : undefined);
    return typeof result === 'number' ? <div dir="ltr" className="cw-readout">{nfmt(result, props)}</div> : <ResultTable headers={result[0].map((_, i) => nfmt(i + 1, props))} rows={result.map((row) => row.map((v) => nfmt(v, props)))} />;
  }}>
    <CalcSelect label={t('العملية', 'Operation')} value={op} set={setOp} items={optionsFor(MATRIX_OPERATIONS, t)} />
    {op === 'identity' ? <CalcSelect label={t('الأبعاد', 'Size')} value={size} set={setSize} items={['1', '2', '3', '4'].map((n) => [n, `${displayDigits(n, props.lang)} × ${displayDigits(n, props.lang)}`])} /> : <div className="cw-form-grid">
      <CalcInput label={t('مصفوفة A', 'Matrix A')} value={a} set={setA} area />
      {['add', 'subtract', 'multiply'].includes(op) && <CalcInput label={t('مصفوفة B', 'Matrix B')} value={b} set={setB} area />}
    </div>}
  </ModeForm>;
}

const VECTOR_OPERATIONS: Record<VectorOperation, [string, string]> = {
  add: ['A + B', 'A + B'], subtract: ['A − B', 'A − B'], dot: ['ضرب قياسي A · B', 'Dot product A · B'], cross: ['ضرب اتجاهي A × B', 'Cross product A × B'],
  angle: ['الزاوية بينهما', 'Angle between vectors'], unit: ['متجه الوحدة لـ A', 'Unit vector of A'], norm: ['طول A', 'Magnitude of A'],
};
function VectorMode(props: ModeProps) {
  const { t, options } = props;
  const [op, setOp] = useState<VectorOperation>('dot');
  const [a, setA] = useState('1 2 3');
  const [b, setB] = useState('4 5 6');
  const needsB = op !== 'unit' && op !== 'norm';
  return <ModeForm t={t} revision={options.angleMode} note={t('افصل بين الإحداثيات بمسافات. الضرب الاتجاهي يحتاج ثلاثة أبعاد.', 'Separate coordinates with spaces. Cross product requires three dimensions.')} run={() => {
    const result = calculateVector(op, numericList(a, props), needsB ? numericList(b, props) : undefined, options.angleMode);
    return <p dir="ltr" className="cw-readout">{Array.isArray(result) ? `[ ${result.map((v) => nfmt(v, props)).join('  ,  ')} ]` : `${nfmt(result, props)}${op === 'angle' ? ` ${options.angleMode}` : ''}`}</p>;
  }}>
    <CalcSelect label={t('العملية', 'Operation')} value={op} set={setOp} items={optionsFor(VECTOR_OPERATIONS, t)} />
    <div className="cw-form-grid"><CalcInput label={t('متجه A', 'Vector A')} value={a} set={setA} />{needsB && <CalcInput label={t('متجه B', 'Vector B')} value={b} set={setB} />}</div>
  </ModeForm>;
}

const COEFFICIENT_DEFAULTS: Record<string, string[]> = { 2: ['1', '0', '-4'], 3: ['1', '0', '-1', '0'], 4: ['1', '0', '-5', '0', '4'] };
function PolynomialFields({ props, degree, changeDegree, values, setValues }: { props: ModeProps; degree: string; changeDegree: (value: string) => void; values: string[]; setValues: (value: string[]) => void }) {
  const { t, lang } = props;
  return <>
    <CalcSelect label={t('درجة متعددة الحدود', 'Polynomial degree')} value={degree} set={changeDegree} items={['2', '3', '4'].map((v) => [v, displayDigits(v, lang)])} />
    <div className="cw-coefficients" dir="ltr">{values.map((value, i) => {
      const order = Number(degree) - i;
      const label = order === 0 ? '1' : order === 1 ? 'x' : `x^${displayDigits(String(order), lang)}`;
      return <CalcInput key={i} label={label} value={value} set={(next) => setValues(values.map((v, j) => i === j ? next : v))} max={40} />;
    })}</div>
  </>;
}

function EquationMode(props: ModeProps) {
  const { t, lang, options } = props;
  const [kind, setKind] = useState('polynomial');
  const [degree, setDegree] = useState('2');
  const [values, setValues] = useState(COEFFICIENT_DEFAULTS['2']);
  const [system, setSystem] = useState('1 1 5\n1 -1 1');
  const [expression, setExpression] = useState('x^2 = 2');
  const [guess, setGuess] = useState('1');
  return <ModeForm t={t} revision={options.angleMode} action={t('حل المعادلة', 'Solve')} note={kind === 'system' ? t('لكل سطر: معاملات المجهولات ثم الطرف الأيمن (من مجهولين لأربعة).', 'Each line: coefficients followed by the right-hand side (2–4 unknowns).') : kind === 'solver' ? t('الحل العددي تقريبي؛ قد يختلف الجذر حسب نقطة البداية.', 'Numerical solving is approximate; the starting value affects which root is found.') : undefined} run={() => {
    if (kind === 'polynomial') {
      const co = values.map((v) => num(v, props));
      const roots = solvePolynomial(co);
      const rows: [string, string][] = roots.map((root, i) => [`x${displayDigits(String(i + 1), lang)}`, formatComplex(root, lang)]);
      if (co.length === 3) {
        const x = -0.5 * (co[1] / co[0]);
        const y = (co[0] * x + co[1]) * x + co[2];
        if (Number.isFinite(x) && Number.isFinite(y)) rows.push([co[0] > 0 ? t('أدنى قيمة (x، y)', 'Minimum (x, y)') : t('أقصى قيمة (x، y)', 'Maximum (x, y)'), `(${nfmt(x, props)}, ${nfmt(y, props)})`]);
      }
      return <DataList rows={rows} />;
    }
    if (kind === 'system') {
      const rows = numericRows(system, props);
      const roots = solveLinearSystem(rows.map((row) => row.slice(0, -1)), rows.map((row) => row.at(-1)!));
      return <DataList rows={roots.map((x, i) => [`x${displayDigits(String(i + 1), lang)}`, nfmt(x, props)])} />;
    }
    const { root, residual } = solveNumericEquation(expression, num(guess, props), options);
    return <DataList rows={[[t('الجذر التقريبي', 'Approximate root'), nfmt(root, props)], [t('الفرق بين الطرفين', 'Residual'), nfmt(residual, props)]]} />;
  }}>
    <CalcSelect label={t('نوع المعادلة', 'Equation type')} value={kind} set={setKind} items={[[ 'polynomial', t('متعددة الحدود', 'Polynomial')], ['system', t('نظام معادلات خطية', 'Simultaneous equations')], ['solver', t('حل عددي في x', 'Numerical solver in x')]]} />
    {kind === 'polynomial' ? <PolynomialFields props={props} degree={degree} changeDegree={(v) => { setDegree(v); setValues(COEFFICIENT_DEFAULTS[v]); }} values={values} setValues={setValues} /> : kind === 'system' ? <CalcInput label={t('المعاملات والنتائج', 'Coefficients and right-hand side')} value={system} set={setSystem} area /> : <>
      <CalcInput label={t('المعادلة', 'Equation')} value={expression} set={setExpression} />
      <CalcInput label={t('قيمة البداية لـ x', 'Starting value for x')} value={guess} set={setGuess} />
    </>}
  </ModeForm>;
}

function InequalityMode(props: ModeProps) {
  const { t, lang, options } = props;
  const [degree, setDegree] = useState('2');
  const [values, setValues] = useState(COEFFICIENT_DEFAULTS['2']);
  const [op, setOp] = useState<InequalityOperator>('<=');
  return <ModeForm t={t} revision={options.angleMode} action={t('حل المتباينة', 'Solve inequality')} run={() => {
    const ranges = solvePolynomialInequality(values.map((v) => num(v, props)), op);
    const text = ranges.map(({ from, to, includeFrom, includeTo }) => from === to ? `{${nfmt(from, props)}}` : `${includeFrom ? '[' : '('}${nfmt(from, props)}, ${nfmt(to, props)}${includeTo ? ']' : ')'}`).join(' ∪ ');
    return <p className="cw-readout" dir="ltr">{text || '∅'}</p>;
  }}>
    <PolynomialFields props={props} degree={degree} changeDegree={(v) => { setDegree(v); setValues(COEFFICIENT_DEFAULTS[v]); }} values={values} setValues={setValues} />
    <CalcSelect label={t('متعددة الحدود مقارنة بصفر', 'Compare polynomial to zero')} value={op} set={setOp} ltr items={[[ '>', `> ${displayDigits('0', lang)}`], ['>=', `≥ ${displayDigits('0', lang)}`], ['<', `< ${displayDigits('0', lang)}`], ['<=', `≤ ${displayDigits('0', lang)}`]]} />
  </ModeForm>;
}

function TableMode(props: ModeProps) {
  const { t, functions, updateFunction, options } = props;
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('5');
  const [step, setStep] = useState('1');
  return <ModeForm t={t} revision={`${options.angleMode}:${functions.f}:${functions.g}`} action={t('ولِّد الجدول', 'Generate table')} note={t('الحد الأقصى ٤٥ صفًا. يمكنك ترك إحدى الدالتين فارغة.', 'Up to 45 rows. Either function may be left blank.')} run={() => {
    const entries = ([['f(x)', functions.f], ['g(x)', functions.g]] as const).filter(([, body]) => body?.trim());
    const rows = engineeringTable(entries.map(([, body]) => body!), num(start, props), num(end, props), num(step, props), options);
    return <ResultTable headers={['x', ...entries.map(([name]) => name)]} rows={rows.map((row) => row.map((x) => x === null ? '—' : nfmt(x, props)))} />;
  }}>
    <div className="cw-form-grid"><CalcInput label="f(x)" value={functions.f ?? ''} set={(v) => updateFunction('f', v)} placeholder="x^2" /><CalcInput label="g(x)" value={functions.g ?? ''} set={(v) => updateFunction('g', v)} placeholder="2*x+1" /></div>
    <div className="cw-form-grid cw-three"><CalcInput label={t('البداية', 'Start')} value={start} set={setStart} /><CalcInput label={t('النهاية', 'End')} value={end} set={setEnd} /><CalcInput label={t('الخطوة', 'Step')} value={step} set={setStep} /></div>
  </ModeForm>;
}

const REGRESSIONS: Record<RegressionKind, [string, string]> = {
  linear: ['خطي', 'Linear'], quadratic: ['تربيعي', 'Quadratic'], logarithmic: ['لوغاريتمي', 'Logarithmic'], exponential: ['أُسّي (e)', 'Exponential (e)'],
  exponentialBase: ['أُسّي (b)', 'Exponential (b)'], power: ['قوة', 'Power'], inverse: ['عكسي', 'Inverse'],
};
const MODELS: Record<RegressionKind, string> = { linear: 'a+bx', quadratic: 'a+bx+cx²', logarithmic: 'a+b·ln(x)', exponential: 'a·e^(bx)', exponentialBase: 'a·b^x', power: 'a·x^b', inverse: 'a+b/x' };
function StatisticsMode(props: ModeProps) {
  const { t, options } = props;
  const [kind, setKind] = useState<'single' | RegressionKind>('single');
  const [data, setData] = useState('2, 4, 6, 8');
  const [pairs, setPairs] = useState('1 3\n2 5\n3 7');
  const [predict, setPredict] = useState('');
  const stats = (values: number[]) => {
    const s = summarizeStatistics(values);
    return [[t('عدد القيم', 'Count'), s.n], [t('المجموع', 'Sum'), s.sum], [t('المتوسط', 'Mean'), s.mean], [t('الوسيط', 'Median'), s.median],
      [t('أصغر قيمة', 'Minimum'), s.min], [t('أكبر قيمة', 'Maximum'), s.max], ['σ', s.populationDeviation], ['s', s.sampleDeviation]] as [string, number | null][];
  };
  return <ModeForm t={t} revision={options.angleMode} note={kind === 'single' ? t('افصل الأعداد بمسافات أو فواصل. σ للمجتمع وs للعينة.', 'Separate values with spaces or commas. σ is population SD; s is sample SD.') : t('اكتب كل زوج x وy في سطر مستقل.', 'Enter one x and y pair per line.')} run={() => {
    if (kind === 'single') return <DataList rows={stats(numericList(data, props)).map(([key, value]) => [key, value === null ? '—' : nfmt(value, props)])} />;
    const points = numericRows(pairs, props);
    if (points.some((row) => row.length !== 2)) throw new Error('Enter exactly two values per line.');
    const fit = fitRegression(kind, points as [number, number][]);
    const rows: [string, string][] = fit.coefficients.map((v, i) => ['abc'[i], nfmt(v, props)]);
    rows.unshift([t('النموذج', 'Model'), `y = ${MODELS[kind]}`]);
    rows.push(['R²', fit.rSquared === null ? '—' : nfmt(fit.rSquared, props)]);
    if (predict.trim()) rows.push(['ŷ', nfmt(fit.predict(num(predict, props)), props)]);
    const yStats = stats(points.map(([, y]) => y));
    return <><DataList rows={rows} /><details className="cw-details"><summary>{t('إحصاء x وy', 'Summary for x and y')}</summary><ResultTable headers={['', 'x', 'y']} rows={stats(points.map(([x]) => x)).map(([label, x], i) => { const y = yStats[i][1]; return [label, x === null ? '—' : nfmt(x, props), y === null ? '—' : nfmt(y, props)]; })} /></details></>;
  }}>
    <CalcSelect label={t('وضع الإحصاء', 'Statistics mode')} value={kind} set={setKind} items={[['single', t('متغير واحد', 'One variable')], ...optionsFor(REGRESSIONS, t)]} />
    {kind === 'single' ? <CalcInput label={t('القيم', 'Values')} value={data} set={setData} max={3500} area /> : <><CalcInput label={t('أزواج x وy', 'x and y pairs')} value={pairs} set={setPairs} max={3500} area /><CalcInput label={t('توقُّع y عند x (اختياري)', 'Predict y at x (optional)')} value={predict} set={setPredict} /></>}
  </ModeForm>;
}

const DISTRIBUTION_LABELS = {
  normalDensity: ['الكثافة الطبيعية', 'Normal PDF'], normalProbability: ['الاحتمال الطبيعي في نطاق', 'Normal CDF (interval)'], inverseNormal: ['الطبيعي العكسي', 'Inverse normal'],
  binPdf: ['ثنائي الحدين: احتمال مفرد', 'Binomial PDF'], binCdf: ['ثنائي الحدين: تراكمي', 'Binomial CDF'], poisPdf: ['بواسون: احتمال مفرد', 'Poisson PDF'], poisCdf: ['بواسون: تراكمي', 'Poisson CDF'],
} satisfies Record<string, [string, string]>;
type Distribution = keyof typeof DISTRIBUTION_LABELS;
function DistributionMode(props: ModeProps) {
  const { t, options } = props;
  const [kind, setKind] = useState<Distribution>('normalProbability');
  const [fields, setFields] = useState({ x: '0', lower: '-1', upper: '1', mean: '0', sd: '1', area: '0.975', n: '10', p: '0.5', rate: '2' });
  const input = (key: keyof typeof fields, label: string) => <CalcInput key={key} label={label} value={fields[key]} set={(v) => setFields({ ...fields, [key]: v })} />;
  const isNormal = kind.startsWith('normal') || kind === 'inverseNormal';
  const evaluate = (key: keyof typeof fields) => num(fields[key], props);
  return <ModeForm t={t} revision={options.angleMode} run={() => {
    let value: number;
    switch (kind) {
      case 'normalDensity': value = normalDensity(evaluate('x'), evaluate('mean'), evaluate('sd')); break;
      case 'normalProbability': value = normalProbability(evaluate('lower'), evaluate('upper'), evaluate('mean'), evaluate('sd')); break;
      case 'inverseNormal': value = inverseNormal(evaluate('area'), evaluate('mean'), evaluate('sd')); break;
      case 'binPdf': case 'binCdf': value = binomialProbability(evaluate('x'), evaluate('n'), evaluate('p'), kind === 'binCdf'); break;
      default: value = poissonProbability(evaluate('x'), evaluate('rate'), kind === 'poisCdf');
    }
    return <p dir="ltr" className="cw-readout">{nfmt(value, props)}</p>;
  }}>
    <CalcSelect label={t('التوزيع', 'Distribution')} value={kind} set={setKind} items={optionsFor(DISTRIBUTION_LABELS, t)} />
    <div className="cw-form-grid">
      {kind === 'normalProbability' ? [input('lower', t('الحد الأدنى', 'Lower bound')), input('upper', t('الحد الأعلى', 'Upper bound'))] : kind === 'inverseNormal' ? input('area', t('احتمال الذيل الأيسر', 'Left-tail probability')) : input('x', 'x')}
      {isNormal ? [input('mean', 'μ'), input('sd', 'σ')] : kind.startsWith('bin') ? [input('n', 'n'), input('p', 'p')] : input('rate', 'λ')}
    </div>
  </ModeForm>;
}

function BaseMode(props: ModeProps) {
  const { t, lang } = props;
  const [radix, setRadix] = useState('10');
  const [op, setOp] = useState<BaseOperation>('=');
  const [a, setA] = useState('10');
  const [b, setB] = useState('1');
  return <ModeForm t={t} note={t('أعداد صحيحة بإشارة (٣٢ بت)؛ تُعرض القيم السالبة خارج العشري بالمتمّم الثنائي.', 'Signed 32-bit integers; negative non-decimal results use two’s complement.')} run={() => {
    const clean = (s: string) => toLatinDigits(s).replace(/−/g, '-');
    const result = calculateBaseN(clean(a), clean(b), Number(radix) as Radix, op);
    return <DataList rows={([10, 16, 8, 2] as const).map((base) => [displayDigits(String(base), lang), displayDigits(result[base], lang)])} />;
  }}>
    <div className="cw-form-grid"><CalcSelect label={t('نظام الإدخال', 'Input base')} value={radix} set={setRadix} items={[[ '10', t('عشري', 'Decimal')], ['2', t('ثنائي', 'Binary')], ['8', t('ثماني', 'Octal')], ['16', t('ست عشري', 'Hexadecimal')]]} />
      <CalcSelect label={t('العملية', 'Operation')} value={op} set={setOp} items={(['=', '+', '-', '*', '/', 'AND', 'OR', 'XOR', 'XNOR', 'NOT'] as const).map((v) => [v, v === '=' ? t('تحويل', 'Convert') : v])} ltr />
    </div>
    <div className="cw-form-grid"><CalcInput label="A" value={a} set={setA} max={35} />{op !== '=' && op !== 'NOT' && <CalcInput label="B" value={b} set={setB} max={35} />}</div>
  </ModeForm>;
}

function RatioMode(props: ModeProps) {
  const { t, options } = props;
  const [missing, setMissing] = useState<'left' | 'right'>('left');
  const [a, setA] = useState('2');
  const [b, setB] = useState('3');
  const [known, setKnown] = useState('9');
  return <ModeForm t={t} revision={options.angleMode} run={() => <p dir="ltr" className="cw-readout">X = {nfmt(solveRatio(num(a, props), num(b, props), num(known, props), missing), props)}</p>}>
    <CalcSelect label={t('المجهول', 'Unknown')} value={missing} set={setMissing} items={[[ 'left', 'A : B = X : D'], ['right', 'A : B = C : X']]} ltr />
    <div className="cw-form-grid cw-three" dir="ltr"><CalcInput label="A" value={a} set={setA} /><CalcInput label="B" value={b} set={setB} /><CalcInput label={missing === 'left' ? 'D' : 'C'} value={known} set={setKnown} /></div>
  </ModeForm>;
}

const CATEGORY_NAMES: Record<EngineeringUnitCategory, [string, string]> = {
  length: ['طول', 'Length'], area: ['مساحة', 'Area'], volume: ['حجم', 'Volume'], mass: ['كتلة', 'Mass'], temperature: ['حرارة', 'Temperature'],
  pressure: ['ضغط', 'Pressure'], speed: ['سرعة', 'Speed'], energy: ['طاقة', 'Energy'], power: ['قدرة', 'Power'], voltage: ['جهد كهربائي', 'Voltage'],
  current: ['تيار كهربائي', 'Current'], resistance: ['مقاومة', 'Resistance'], frequency: ['تردد', 'Frequency'],
};
function UnitMode(props: ModeProps) {
  const { t, options } = props;
  const [category, setCategory] = useState<EngineeringUnitCategory>('length');
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('m');
  const [value, setValue] = useState('1');
  const items = ENGINEERING_UNITS[category].map((unit) => [unit, unit] as const);
  return <ModeForm t={t} revision={`${options.angleMode}:${category}:${from}:${to}`} action={t('حوّل', 'Convert')} run={() => <p dir="ltr" className="cw-readout">{nfmt(convertEngineeringUnit(num(value, props), category, from, to), props)} <small>{to}</small></p>}>
    <CalcSelect label={t('نوع القياس', 'Measurement')} value={category} set={(v) => { setCategory(v); setFrom(ENGINEERING_UNITS[v][0]); setTo(ENGINEERING_UNITS[v][1]); }} items={optionsFor(CATEGORY_NAMES, t)} />
    <CalcInput label={t('القيمة', 'Value')} value={value} set={setValue} />
    <div className="cw-form-grid cw-convert"><CalcSelect label={t('من', 'From')} value={from} set={setFrom} items={items} ltr />
      <button type="button" className="cw-tiny-button" onClick={() => { setFrom(to); setTo(from); }} title={t('بدّل الوحدتين', 'Swap units')} aria-label={t('بدّل الوحدتين', 'Swap units')}><ArrowLeftRight size={16} /></button>
      <CalcSelect label={t('إلى', 'To')} value={to} set={setTo} items={items} ltr />
    </div>
  </ModeForm>;
}

function MathBoxMode(props: ModeProps) {
  const { t, lang } = props;
  const [kind, setKind] = useState<'dice' | 'coin'>('dice');
  const [items, setItems] = useState('2');
  const [trials, setTrials] = useState('30');
  const [seed, setSeed] = useState('');
  return <ModeForm t={t} action={t('ابدأ المحاكاة', 'Run simulation')} note={t('جرّب لحد ٢٥٠ مرة أو اختار نتيجة قابلة للتكرار.', 'Run up to 250 trials or choose a repeatable sequence.')} run={() => {
    const { rolls, frequencies } = simulateMathBox(kind, Number(items), num(trials, props), seed ? Number(seed) : undefined);
    return <>
      <ResultTable headers={[kind === 'dice' ? t('المجموع', 'Total') : t('عدد الصور', 'Heads'), t('التكرار', 'Count'), '%']} rows={frequencies.map(({ outcome, count, relative }) => [nfmt(outcome, props), nfmt(count, props), displayNumber(100 * relative, lang, 4)])} />
      <details className="cw-details"><summary>{t('نتائج كل رمية', 'Individual trials')}</summary><ResultTable headers={['#', ...rolls[0].map((_, i) => nfmt(i + 1, props))]} rows={rolls.map((row, i) => [nfmt(i + 1, props), ...row.map((value) => nfmt(value, props))])} /></details>
    </>;
  }}>
    <CalcSelect label={t('التجربة', 'Experiment')} value={kind} set={setKind} items={[[ 'dice', t('رمي النرد', 'Dice roll')], ['coin', t('رمي العملات', 'Coin toss')]]} />
    <div className="cw-form-grid"><CalcSelect label={t('العدد لكل رمية', 'Items per trial')} value={items} set={setItems} items={['1', '2', '3'].map((i) => [i, displayDigits(i, lang)])} /><CalcInput label={t('المحاولات', 'Trials')} value={trials} set={setTrials} /></div>
    <CalcSelect label={t('النتيجة المتكررة', 'Repeatable result')} value={seed} set={setSeed} items={[[ '', t('عشوائية', 'Random')], ...['1', '2', '3'].map((i) => [i, `#${displayDigits(i, lang)}`] as const)]} />
  </ModeForm>;
}

function SpreadsheetMode({ t, lang, options }: ModeProps) {
  const [cells, setCells] = useState<Record<string, string>>({});
  const [active, setActive] = useState('A1');
  const [error, setError] = useState(false);
  const results = useMemo(() => evaluateEngineeringSheet(cells, options.angleMode), [cells, options.angleMode]);
  const setCell = (text: string) => {
    if (text && !Object.hasOwn(cells, active) && Object.keys(cells).length >= SHEET_CELL_LIMIT) { setError(true); return; }
    setError(false);
    setCells((prev) => { const next = { ...prev }; if (text) next[active] = text; else delete next[active]; return next; });
  };
  return <div className="cw-mode-form">
    <CalcInput label={`${t('الخلية', 'Cell')} ${displayDigits(active, lang)}`} value={cells[active] ?? ''} set={setCell} placeholder="=SUM(A1:A3)" max={SHEET_CELL_LENGTH} />
    <p className="cw-help">{t('اختار خلية واكتب قيمة أو صيغة زي ‎=A1*2‎ أو ‎=SUM(A1:A3)‎. الخلايا الفارغة تساوي صفر عند الإشارة إليها.', 'Select a cell and enter a value or formula, e.g. =A1*2 or =SUM(A1:A3). Direct references to empty cells are zero.')}</p>
    {error && <p role="alert" className="cw-form-error">{t('الحد الأقصى ١٧٠ خلية مليانة.', 'The sheet holds up to 170 filled cells.')}</p>}
    <div className="cw-table-wrap cw-sheet-wrap" dir="ltr"><table className="cw-table cw-sheet"><thead><tr><th>#</th>{SHEET_COLUMNS.map((col) => <th scope="col" key={col}>{col}</th>)}</tr></thead><tbody>
    {Array.from({ length: SHEET_ROWS }, (_, index) => <tr key={index}><th scope="row">{displayDigits(String(index + 1), lang)}</th>{SHEET_COLUMNS.map((col, colIndex) => {
      const key = `${col}${index + 1}`;
      const result = results[key];
      const value = result && ('value' in result ? displayNumber(result.value, lang, 7) : result.error === 'cycle' ? '#REF!' : '#ERR');
      return <td key={key}><button type="button" className="cw-cell cw-mono" data-cell={key} aria-pressed={key === active} tabIndex={key === active ? 0 : -1} aria-label={`${displayDigits(key, lang)} ${value || ''}`.trim()}
        onClick={() => { setActive(key); setError(false); }} onKeyDown={(e) => {
          const rowOffset = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
          const colOffset = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          if (!rowOffset && !colOffset) return;
          e.preventDefault();
          const row = Math.max(0, Math.min(SHEET_ROWS - 1, index + rowOffset));
          const column = Math.max(0, Math.min(SHEET_COLUMNS.length - 1, colIndex + colOffset));
          const next = `${SHEET_COLUMNS[column]}${row + 1}`;
          setActive(next); setError(false);
          e.currentTarget.closest('table')?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
        }}>{value || ''}</button></td>;
    })}</tr>)}
    </tbody></table></div>
  </div>;
}

const TOOL_PANELS = { matrix: MatrixMode, vector: VectorMode, equation: EquationMode, inequality: InequalityMode, table: TableMode, statistics: StatisticsMode, distribution: DistributionMode, base: BaseMode, ratio: RatioMode, units: UnitMode, mathbox: MathBoxMode, spreadsheet: SpreadsheetMode } satisfies Record<ToolMode, (props: ModeProps) => ReactNode>;

/** Keep visited drafts when switching apps, without mounting the entire spreadsheet on the home screen. */
export function CalculatorModes({ current, visited, ...props }: ModeProps & { current: CalcMode | null; visited: readonly ToolMode[] }) {
  return <>{visited.map((mode) => {
    const Panel = TOOL_PANELS[mode];
    return <div key={mode} className="cw-app" hidden={mode !== current}><Panel {...props} /></div>;
  })}</>;
}
