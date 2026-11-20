import { useState } from 'react';
import { evaluateEngineeringExpression } from '../../utils/engineeringCalculator';
import { displayDigits, displayNumber } from './calculatorDisplay';
import { CalcInput, CalcSelect, DataList, ModeForm, nfmt, num, type ModeProps } from './calculatorFields';

type End = 'open' | 'closed' | 'unbounded';
function LineFigure({ low, high, begin, end, props }: { low: number; high: number; begin: End; end: End; props: ModeProps }) {
  const { t } = props;
  const finiteBounds = [begin !== 'unbounded' ? low : undefined, end !== 'unbounded' ? high : undefined].filter((v): v is number => v !== undefined);
  const center = finiteBounds.length < 2 ? finiteBounds[0] ?? 0 : (low + high) / 2;
  const radius = Math.max(1, Math.abs(center) * 1e-12, finiteBounds.length === 2 ? (high - low) * 0.75 : Math.abs(center) * 0.2);
  const x = (v: number) => 148 + (v - center) / radius * 126;
  const from = begin === 'unbounded' ? 15 : x(low), to = end === 'unbounded' ? 281 : x(high);
  const empty = low === high && finiteBounds.length === 2 && (begin !== 'closed' || end !== 'closed');
  const label = empty ? '∅' : `${begin === 'closed' ? '[' : '('}${begin === 'unbounded' ? '−∞' : nfmt(low, props)}, ${end === 'unbounded' ? '∞' : nfmt(high, props)}${end === 'closed' ? ']' : ')'}`;
  return <>
    <svg viewBox="0 0 296 70" className="cw-plot" role="img" aria-label={`${t('خط الأعداد', 'Number line')}: ${label}`}>
      <rect className="cw-plot-bg" width="296" height="70" rx="6" />
      <path className="cw-plot-axes" d="M10 29H286 M16 24L10 29L16 34 M280 24L286 29L280 34" />
      {Math.abs(center) <= radius && <path className="cw-plot-axes" d={`M${x(0)} 23V35`} />}
      {!empty && <g stroke="#126854" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d={`M${from} 29H${to}`} />
        {begin === 'unbounded' ? <path d="M21 24L15 29L21 34" /> : <circle cx={from} cy="29" r="4.5" fill={begin === 'closed' ? '#126854' : '#f0f5e8'} />}
        {end === 'unbounded' ? <path d="M275 24L281 29L275 34" /> : <circle cx={to} cy="29" r="4.5" fill={end === 'closed' ? '#126854' : '#f0f5e8'} />}
      </g>}
      <text className="cw-axis-name" x="148" y="54" textAnchor="middle">{label}</text>
    </svg>
    <p className="cw-plot-note">{t('الدائرة المصمتة تعني إن الطرف داخل الفترة. الدائرة الفاضية تعني إنه برّه.', 'A filled dot includes the endpoint; a hollow dot excludes it.')}</p>
  </>;
}
export function NumberLineTool(props: ModeProps) {
  const { t, lang, options } = props;
  const [low, setLow] = useState('-2');
  const [high, setHigh] = useState('3');
  const [begin, setBegin] = useState<End>('open');
  const [end, setEnd] = useState<End>('closed');
  const items = [[ 'open', t('مفتوح', 'Open')], ['closed', t('مغلق', 'Closed')], ['unbounded', t('بدون حد', 'Unbounded')]] as const;
  return <ModeForm t={t} revision={`${lang}:${options.angleMode}`} action={t('ارسم خط الأعداد', 'Draw number line')} run={() => {
    const l = begin === 'unbounded' ? 0 : num(low, props), h = end === 'unbounded' ? 0 : num(high, props);
    if (Math.max(Math.abs(l), Math.abs(h)) > 1e12 || begin !== 'unbounded' && end !== 'unbounded' && l > h) throw new Error('Use ordered, finite endpoints within ±10^12.');
    return <LineFigure low={l} high={h} begin={begin} end={end} props={props} />;
  }}>
    <div className="cw-form-grid"><CalcSelect label={t('نوع الطرف الشمال', 'Left endpoint type')} value={begin} set={setBegin} items={items} />
      <CalcSelect label={t('نوع الطرف اليمين', 'Right endpoint type')} value={end} set={setEnd} items={items} /></div>
    <div className="cw-form-grid">{begin !== 'unbounded' && <CalcInput label={t('أول الفترة', 'Lower endpoint')} value={low} set={setLow} />}
      {end !== 'unbounded' && <CalcInput label={t('آخر الفترة', 'Upper endpoint')} value={high} set={setHigh} />}</div>
  </ModeForm>;
}

function CircleView({ start, props }: { start: number; props: ModeProps }) {
  const { t, lang, options } = props;
  const unit = options.angleMode ?? 'DEG';
  const max = unit === 'DEG' ? 360 : unit === 'GRAD' ? 400 : 2 * Math.PI;
  const [turn, setTurn] = useState(start);
  const rad = turn * Math.PI / 180;
  const x = 148 + 58 * Math.cos(rad), y = 75 - 58 * Math.sin(rad);
  const angle = unit === 'DEG' ? turn : turn / 360 * max;
  const calc = (f: string) => { try { return displayNumber(evaluateEngineeringExpression(`${f}(${turn})`, { angleMode: 'DEG' }), lang); } catch { return '—'; } };
  return <div className="cw-graph-result">
    <svg viewBox="0 0 296 150" className="cw-plot" role="img" aria-label={t('دائرة الوحدة وإسقاطات الجيب وجيب التمام', 'Unit circle with sine and cosine projections')}>
      <rect className="cw-plot-bg" width="296" height="150" rx="6" />
      <path className="cw-plot-axes" d="M74 75H224 M148 7V143" /><circle cx="148" cy="75" r="58" className="cw-plot-grid-line" fill="none" />
      <path d={`M148 75L${x} ${y}`} stroke="#126854" strokeWidth="2" />
      <path d={`M${x} ${y}V75H148`} stroke="#8e3e6b" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
      {turn > 0 && turn < 360 && <path d={`M170 75 A22 22 0 ${turn > 180 ? 1 : 0} 0 ${148 + 22 * Math.cos(rad)} ${75 - 22 * Math.sin(rad)}`} stroke="#315caa" strokeWidth="1.5" fill="none" />}
      <circle cx={x} cy={y} r="4" fill="#126854" /><text x="226" y="79" className="cw-axis-name">x</text><text x="154" y="15" className="cw-axis-name">y</text>
      <text x="238" y="33" className="cw-axis-name">{displayDigits('r=1', lang)}</text>
    </svg>
    <label className="cw-trace"><span>{t('حرّك الزاوية', 'Move the angle')} · {nfmt(angle, props)} {unit}</span>
      <input type="range" dir="ltr" min="0" max="360" step="0.1" value={turn} onChange={(event) => setTurn(Number(event.target.value))} aria-valuetext={`${nfmt(angle, props)} ${unit}`} /></label>
    <DataList rows={[[ 'x = cos θ', calc('cos')], ['y = sin θ', calc('sin')], ['tan θ', calc('tan')]]} />
    <p className="cw-plot-note">{t('مكان النقطة يبيّن الجيب وجيب التمام. الظل غير معرّف عند ما جيب التمام يساوي صفر.', 'The point shows cosine and sine. Tangent is undefined when cosine is zero.')}</p>
  </div>;
}
export function CircleTool(props: ModeProps) {
  const { t, lang, options } = props;
  const unit = options.angleMode ?? 'DEG';
  const [start, setStart] = useState('');
  const initial = unit === 'RAD' ? 'pi/6' : unit === 'GRAD' ? '100/3' : '30';
  return <ModeForm t={t} revision={`${lang}:${unit}`} action={t('ارسم دائرة الوحدة', 'Draw unit circle')} run={() => {
    const angle = num(start || initial, props), revolution = unit === 'RAD' ? 2 * Math.PI : unit === 'GRAD' ? 400 : 360;
    const degrees = (angle % revolution) / revolution * 360;
    return <CircleView key={`${unit}:${degrees}`} start={degrees < 0 ? degrees + 360 : degrees} props={props} />;
  }}>
    <CalcInput label={`${t('الزاوية', 'Angle')} (${unit})`} value={start} set={setStart} placeholder={displayDigits(initial, lang)} />
  </ModeForm>;
}
