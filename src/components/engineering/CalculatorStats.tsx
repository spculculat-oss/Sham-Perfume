import { engineeringPercentField, splitEngineeringValues } from '../../utils/engineeringInput';
import { useState } from 'react';
import { engineeringBoxPlot, inferMean } from '../../utils/engineeringInference';
import { displayNumber } from './calculatorDisplay';
import { CalcInput, CalcSelect, DataList, ModeForm, nfmt, num, type ModeProps } from './calculatorFields';

const fraction = (v: number, low: number, high: number) => low === high ? 0.5 : (v / 2 - low / 2) / (high / 2 - low / 2 || Number.MIN_VALUE);
export function BoxPlot({ values, props }: { values: number[]; props: ModeProps }) {
  const { t } = props;
  const plot = engineeringBoxPlot(values);
  const x = (value: number) => 16 + 264 * fraction(value, plot.min, plot.max);
  return <>
    <svg viewBox="0 0 296 82" role="img" aria-label={t('مخطط الصندوق والشارب', 'Box-and-whisker plot')} className="cw-plot">
      <rect className="cw-plot-bg" width="296" height="82" rx="6" />
      <path className="cw-plot-grid-line" d="M16 60H280" />
      <path d={`M${x(plot.lower)} 25V41 M${x(plot.lower)} 33H${x(plot.upper)} M${x(plot.upper)} 25V41`} fill="none" stroke="#315caa" strokeWidth="1.5" />
      <rect x={x(plot.q1)} y="19" width={Math.max(1, x(plot.q3) - x(plot.q1))} height="28" fill="#c5dfd2" stroke="#126854" />
      <path d={`M${x(plot.median)} 19V47`} stroke="#126854" strokeWidth="2" />
      {plot.outliers.map((v, i) => <circle key={i} cx={x(v)} cy="33" r="2.8" fill="#8e3e6b" />)}
      <text className="cw-axis-name" x="16" y="74">{displayNumber(plot.min, props.lang, 5)}</text>
      <text className="cw-axis-name" x="280" y="74" textAnchor="end">{displayNumber(plot.max, props.lang, 5)}</text>
    </svg>
    <DataList rows={[[t('الربع الأول', 'First quartile'), nfmt(plot.q1, props)], [t('الربع الثالث', 'Third quartile'), nfmt(plot.q3, props)], [t('قيم خارج الشوارب', 'Outside whiskers'), nfmt(plot.outliers.length, props)]]} />
    <p className="cw-plot-note">{t('الأرباع باستيفاء خطي؛ النقاط خارج حدود ١٫٥ × المدى الربيعي تظهر منفصلة.', 'Quartiles use linear interpolation. Points beyond the 1.5 × IQR fences are shown separately.')}</p>
  </>;
}

export function RegressionPlot({ points, predict, props }: { points: readonly [number, number][]; predict: (x: number) => number; props: ModeProps }) {
  const { t, lang } = props;
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const low = Math.min(...ys), high = Math.max(...ys);
  const x = (value: number) => 34 + 246 * fraction(value, lo, hi);
  const y = (value: number) => Math.min(285, Math.max(-190, 118 - 103 * fraction(value, low, high)));
  const path: string[] = [];
  let started = false;
  let lastSign = 0;
  for (let i = 0; i <= 64; i++) {
    const p = lo * (1 - i / 64) + hi * (i / 64);
    if (p && lastSign && Math.sign(p) !== lastSign) started = false; // don't join inverse-regression branches at zero
    lastSign = Math.sign(p);
    try { path.push(`${started ? 'L' : 'M'}${x(p)} ${y(predict(p))}`); started = true; } catch { started = false; }
  }
  return <div>
    <svg viewBox="0 0 296 144" className="cw-plot" role="img" aria-label={t('نقاط x وy وخط الانحدار', 'Scatter data and fitted curve')}>
      <rect className="cw-plot-bg" width="296" height="144" rx="6" />
      <path className="cw-plot-axes" d="M34 10V118H285" />
      <svg x="34" y="10" width="246" height="109" viewBox="34 10 246 109" overflow="hidden">
        <path className="cw-plot-line" stroke="#126854" d={path.join(' ')} />
      </svg>
      {points.map(([a, b], i) => <circle key={i} cx={x(a)} cy={y(b)} r="3" fill="#8e3e6b" />)}
      <g className="cw-axis-name"><text x="34" y="133">{displayNumber(lo, lang, 4)}</text><text x="280" y="133" textAnchor="end">{displayNumber(hi, lang, 4)}</text>
        <text x="31" y="18" textAnchor="end">{displayNumber(high, lang, 4)}</text><text x="31" y="119" textAnchor="end">{displayNumber(low, lang, 4)}</text></g>
    </svg>
    <p className="cw-plot-note">{t('النقط من بياناتك، والخط النموذج الملائم داخل نطاق القيم. في نماذج التحويل اللوغاريتمي، R² يُحسب على مقياس الملاءمة.', 'Dots are your data and the line is the fit over the observed range. For log-transformed models, R² is on the fitting scale.')}</p>
  </div>;
}

export function InferenceMode(props: ModeProps) {
  const { t, lang, options } = props;
  const [kind, setKind] = useState<'t' | 'z'>('t');
  const [data, setData] = useState('12 13 15 14 16');
  const [nullMean, setNullMean] = useState('12');
  const [confidence, setConfidence] = useState('95');
  const [deviation, setDeviation] = useState('2');
  return <ModeForm t={t} revision={`${lang}:${options.angleMode}`} action={t('احسب الاختبار والفترة', 'Compute test and interval')}
    note={t('لعينة واحدة مستقلة، بافتراض نموذج طبيعي أو تقريب مناسب للعينة. اختبار ثنائي الطرف وفترة ثقة. قيمة p مش احتمال إن فرض الصفر صحيح.', 'One independent sample under a normal model or justified approximation. Two-sided test and confidence interval. p is not the probability the null hypothesis is true.')}
    run={() => {
      const parts = splitEngineeringValues(data);
      if (parts.length < 2) throw new Error('Enter at least two measurements.');
      const values = parts.map((val) => num(val, props));
      const out = inferMean(values, num(nullMean, props), engineeringPercentField(confidence, options), kind === 'z' ? num(deviation, props) : undefined);
      return <DataList rows={[[t('عدد القياسات', 'Sample size'), nfmt(out.count, props)], [t('متوسط العينة', 'Sample mean'), nfmt(out.mean, props)],
        [t('الخطأ المعياري', 'Standard error'), nfmt(out.standardError, props)], [kind, nfmt(out.statistic, props)], ...(out.df === undefined ? [] : [['df', nfmt(out.df, props)] as [string, string]]),
        ['p', out.p === 0 ? t('أقل من الدقة العددية', 'Below numeric precision') : nfmt(out.p, props)],
        [`${t('فترة ثقة', 'Confidence interval')} ${nfmt(out.confidence * 100, props)}%`, `[${out.interval.map((n) => nfmt(n, props)).join('; ')}]`]]} />;
    }}>
    <CalcSelect label={t('اختبار المتوسط', 'Mean test')} value={kind} set={setKind} items={[[ 't', t('t · σ مجهول', 't · unknown σ')], ['z', t('z · σ معلوم', 'z · known σ')]]} />
    <CalcInput label={t('قياسات العينة (بمسافات)', 'Sample values (space-separated)')} value={data} set={setData} area max={1600} />
    <div className="cw-form-grid"><CalcInput label={t('متوسط فرض الصفر', 'Null mean')} value={nullMean} set={setNullMean} />
      <CalcInput label={t('مستوى الثقة (%)', 'Confidence (%)')} value={confidence} set={setConfidence} />
      {kind === 'z' && <CalcInput label={t('انحراف المجتمع σ', 'Population SD σ')} value={deviation} set={setDeviation} />}</div>
  </ModeForm>;
}
