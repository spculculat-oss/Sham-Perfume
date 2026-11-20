import { useId, useMemo, useState } from 'react';
import { Crosshair, Focus, LineChart, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { analyzeEngineeringGraph, buildEngineeringGraph, engineeringSurface, GRAPH_SAMPLES, graphIntegral, graphSlope, type EngineeringGraph, type GraphBounds, type GraphKind, type GraphPoint, type SurfaceKind, type SurfacePoint } from '../../utils/engineeringGraph';
import { displayDigits, displayNumber } from './calculatorDisplay';
import { CalcInput, CalcSelect, DataList, ModeForm, ResultTable, nfmt, num, optionsFor, type ModeProps } from './calculatorFields';

const COLORS = ['#126854', '#8e3e6b', '#315caa'];
const SIZE = { width: 320, height: 204, left: 41, right: 307, top: 12, bottom: 179 };
const KINDS: Record<GraphKind, [string, string]> = { cartesian: ['ديكارتي · y=f(x)', 'Cartesian · y=f(x)'], polar: ['قطبي · r(θ)', 'Polar · r(θ)'], parametric: ['بارامتري · x(t), y(t)', 'Parametric · x(t), y(t)'] };
const GRAPH_EXAMPLES: Record<GraphKind, { first: string; second: string }[]> = {
  cartesian: [{ first: 'x^2-4', second: '' }, { first: 'x', second: '' }, { first: '', second: '' }],
  polar: [{ first: '2*cos(3*t)', second: '' }, { first: '', second: '' }, { first: '', second: '' }],
  parametric: [{ first: '3*cos(t)', second: '2*sin(t)' }, { first: '', second: '' }, { first: '', second: '' }],
};

type Shade = 'none' | 'above' | 'below' | 'aboveStrict' | 'belowStrict';
function pieces(points: (GraphPoint | null)[], view: GraphBounds): GraphPoint[][] {
  const out: GraphPoint[][] = [];
  let current: GraphPoint[] = [];
  const flush = () => { if (current.length) out.push(current); current = []; };
  const height = view.top - view.bottom;
  for (const p of points) {
    if (!p) { flush(); continue; }
    const last = current.at(-1);
    // Split potentially discontinuous jumps, not steep but smoothly sampled parts inside the frame.
    if (last && Math.abs(last.y - p.y) > 1.5 * height && (Math.max(last.y, p.y) > view.top || Math.min(last.y, p.y) < view.bottom)) flush();
    current.push(p);
  }
  flush();
  return out;
}
function xyPlot(graph: EngineeringGraph, view: GraphBounds) {
  const { left, right, top, bottom } = SIZE;
  const x = (value: number) => Math.min(1000, Math.max(-700, left + (value - view.left) / (view.right - view.left) * (right - left)));
  const y = (value: number) => Math.min(800, Math.max(-650, bottom - (value - view.bottom) / (view.top - view.bottom) * (bottom - top)));
  return { x, y, series: graph.curves.map((curve) => pieces(curve.points, view).map((segment) => {
    const path = segment.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(2)} ${y(p.y).toFixed(2)}`).join('');
    return { path, first: x(segment[0].x), last: x(segment.at(-1)!.x) };
  })) };
}
const division = (min: number, max: number, i: number, count: number) => min + (max - min) * i / count;

function GraphView({ graph, shade, props }: { graph: EngineeringGraph; shade: Shade; props: ModeProps }) {
  const { t, lang } = props;
  const homeView = useMemo(() => {
    if (graph.kind === 'cartesian') return graph.bounds;
    const { left, right, top, bottom } = graph.bounds;
    const aspect = (SIZE.right - SIZE.left) / (SIZE.bottom - SIZE.top);
    const x = (left + right) / 2, y = (bottom + top) / 2;
    const halfY = Math.max(top - bottom, (right - left) / aspect) / 2;
    return { left: x - halfY * aspect, right: x + halfY * aspect, bottom: y - halfY, top: y + halfY };
  }, [graph]);
  const [view, setView] = useState(homeView);
  const [curveIndex, setCurveIndex] = useState('0');
  const [traceIndex, setTraceIndex] = useState(Math.floor((GRAPH_SAMPLES - 1) / 2));
  const [sketch, setSketch] = useState<'off' | 'tangent' | 'normal'>('off');
  const [analysis, setAnalysis] = useState<{ key: string; data: ReturnType<typeof analyzeEngineeringGraph>; integral?: number }>();
  const clip = useId();
  const trace = graph.curves[Number(curveIndex)].points[traceIndex];
  const plotted = useMemo(() => xyPlot(graph, view), [graph, view]);
  const { x, y, series } = plotted;
  const { width, height, left, right, top, bottom } = SIZE;
  const n = (v: number, digits = 8) => displayNumber(v, lang, digits);
  const move = (scale: number) => {
    const hw = (view.right - view.left) * scale / 2, hh = (view.top - view.bottom) * scale / 2;
    const cx = (view.left + view.right) / 2, cy = (view.bottom + view.top) / 2;
    if (hw >= (homeView.right - homeView.left) / 64 && hh >= (homeView.top - homeView.bottom) / 64 && hw <= (homeView.right - homeView.left) * 8) setView({ left: cx - hw, right: cx + hw, bottom: cy - hh, top: cy + hh });
  };
  const curve = graph.curves[Number(curveIndex)];
  const slope = trace && graph.kind === 'cartesian' && sketch !== 'off' ? graphSlope(curve.at, trace.x) : undefined;
  const lineSlope = slope === undefined ? undefined : sketch === 'normal' ? slope ? -1 / slope : Infinity : slope;
  const results = analysis?.key === curveIndex ? analysis : undefined;
  const above = shade === 'above' || shade === 'aboveStrict';
  const boundary = above ? top : bottom;
  return <div className="cw-graph-result">
    <div className="cw-graph-controls">
      <CalcSelect label={t('المنحنى للتتبّع', 'Trace curve')} value={curveIndex} set={setCurveIndex} items={graph.curves.map(({ label }, i) => [String(i), displayDigits(label, lang)] as const)} ltr />
      <div className="cw-graph-buttons">
        <button type="button" className="cw-tiny-button" onClick={() => move(0.65)} aria-label={t('تكبير الرسم', 'Zoom in')}><ZoomIn size={16} /></button>
        <button type="button" className="cw-tiny-button" onClick={() => move(1.55)} aria-label={t('تصغير الرسم', 'Zoom out')}><ZoomOut size={16} /></button>
        <button type="button" className="cw-tiny-button" onClick={() => setView(homeView)} aria-label={t('إرجاع نطاق الرسم', 'Reset graph view')}><Focus size={16} /></button>
      </div>
    </div>
    <svg className="cw-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('الرسم البياني للدوال', 'Function graph')}>
      <defs><clipPath id={clip}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
      <rect className="cw-plot-bg" x={left} y={top} width={right - left} height={bottom - top} rx="3" />
      {[0, 1, 2, 3, 4].map((i) => {
        const vx = division(view.left, view.right, i, 4);
        const vy = division(view.bottom, view.top, i, 4);
        return <g className="cw-plot-grid" key={i}>
          <path d={`M${x(vx)} ${top}V${bottom} M${left} ${y(vy)}H${right}`} />
          {i % 2 === 0 && <><text x={x(vx)} y={bottom + 13} textAnchor={i === 4 ? 'end' : i ? 'middle' : 'start'}>{n(vx, 4)}</text><text x={left - 4} y={y(vy) + 3} textAnchor="end">{n(vy, 4)}</text></>}
        </g>;
      })}
      <g clipPath={`url(#${clip})`}>
        <path className="cw-plot-axes" d={`M${x(0)} ${top}V${bottom} M${left} ${y(0)}H${right}`} />
        {graph.kind === 'cartesian' && shade !== 'none' && series[0].map(({ path, first, last }, i) => <path key={i} fill={COLORS[0]} opacity={0.16} d={`${path}L${last} ${boundary}L${first} ${boundary}Z`} />)}
        {series.map((parts, i) => parts.map(({ path }, part) => <path className="cw-plot-line" stroke={COLORS[i]} key={`${i}:${part}`} d={path} strokeDasharray={i === 0 && (shade === 'aboveStrict' || shade === 'belowStrict') ? '4 3' : undefined} />))}
        {lineSlope !== undefined && trace && <path className="cw-plot-sketch" d={lineSlope === Infinity ? `M${x(trace.x)} ${top}V${bottom}`
          : `M${left} ${y(trace.y + lineSlope * (view.left - trace.x))}L${right} ${y(trace.y + lineSlope * (view.right - trace.x))}`} />}
        {trace && <><path className="cw-plot-crosshair" d={`M${x(trace.x)} ${top}V${bottom} M${left} ${y(trace.y)}H${right}`} /><circle cx={x(trace.x)} cy={y(trace.y)} r="4" fill={COLORS[Number(curveIndex)]} stroke="white" strokeWidth="1.4" /></>}
      </g>
    </svg>
    <label className="cw-trace"><span><Crosshair size={13} aria-hidden="true" /> {t('حرّك نقطة التتبّع', 'Move trace point')}</span>
      <input type="range" dir="ltr" min="0" max={GRAPH_SAMPLES - 1} value={traceIndex} onChange={(e) => setTraceIndex(Number(e.target.value))} aria-valuetext={trace ? `x: ${n(trace.x)}; y: ${n(trace.y)}` : t('النقطة خارج المجال', 'Outside the domain')} />
    </label>
    <output className="cw-graph-trace" dir="ltr">{trace ? <>{graph.kind !== 'cartesian' && <>t = {n(trace.t)} · </>}x = {n(trace.x)} · y = {n(trace.y)}</> : 'x, y: —'}</output>
    {graph.kind === 'cartesian' && <>
      <CalcSelect label={t('خط عند نقطة التتبّع', 'Line at trace point')} value={sketch} set={setSketch} items={[[ 'off', t('بدون', 'None')], ['tangent', t('مماس', 'Tangent')], ['normal', t('عمودي على المماس', 'Normal')]]} />
      {sketch !== 'off' && <p className="cw-graph-trace" dir="ltr">{slope === undefined ? 'dy/dx: —' : `dy/dx ≈ ${n(slope)}`}</p>}
      <button type="button" className="cw-secondary" onClick={() => setAnalysis({ key: curveIndex, data: analyzeEngineeringGraph(graph, Number(curveIndex)), integral: graphIntegral(curve.at, graph.start, graph.end) })}>{t('حلّل الرسم', 'Analyze graph')} <LineChart size={14} /></button>
      {results && <div className="cw-graph-analysis">
        <DataList rows={[
          [t('جذور تقريبية', 'Approximate zeros'), results.data.allZero ? t('صفر على العيّنات', 'Zero across samples') : results.data.roots.map((r) => n(r)).join(' · ') || '—'],
          [t('نطاق y في العيّنات', 'Sampled y range'), results.data.sampledRange?.map((v) => n(v)).join(' … ') || '—'],
          [t('تكامل على نطاق الرسم', 'Signed integral over range'), results.integral === undefined ? '—' : `≈ ${n(results.integral)}`],
        ]} />
        {results.data.extrema.length > 0 && <ResultTable headers={[t('نقطة محلية', 'Local turn'), 'x', 'y']} rows={results.data.extrema.map((v) => [v.min ? t('صغرى', 'Min') : t('كبرى', 'Max'), n(v.x), n(v.y)])} />}
        {results.data.intersections.map((hit) => <DataList key={hit.label} rows={[[`${t('تقاطع مع', 'Intersections with')} ${displayDigits(hit.label, lang)}`, hit.coincident ? t('متطابق في العيّنات', 'Coincident in samples') : hit.points.map((p) => `(${n(p.x)}, ${n(p.y)})`).join(' · ') || '—']]} />)}
        <p className="cw-plot-note">{t('التحليل عددي داخل النطاق، وممكن يفوّت نقاط قريبة أو انقطاعات. الشرطة معناها مفيش نتيجة مؤكدة بالطريقة دي.', 'Sampled analysis is limited to the range and can miss close features or discontinuities. A dash means no result was confirmed by this method.')}</p>
      </div>}
    </>}
    <details className="cw-details"><summary>{t('جدول من الرسم', 'Graph sample table')}</summary>
      <ResultTable headers={[graph.kind === 'cartesian' ? 'x' : 't', ...(graph.kind === 'cartesian' ? graph.curves.map((c) => displayDigits(c.label, lang)) : ['x', 'y'])]}
        rows={Array.from({ length: 17 }, (_, i) => {
          const index = i * 16;
          const par = division(graph.start, graph.end, index, GRAPH_SAMPLES - 1);
          const p = curve.points[index];
          const values = graph.kind === 'cartesian' ? graph.curves.map((c) => c.points[index]?.y) : [p?.x, p?.y];
          return [n(par), ...values.map((v) => v === undefined ? '—' : n(v))];
        })} />
    </details>
  </div>;
}

export function GraphMode(props: ModeProps) {
  const { t, lang, options, functions } = props;
  const [kind, setKind] = useState<GraphKind>('cartesian');
  const [expressions, setExpressions] = useState(GRAPH_EXAMPLES.cartesian);
  const [start, setStart] = useState('-5');
  const [end, setEnd] = useState('5');
  const [shade, setShade] = useState<Shade>('none');
  const [nonce, setNonce] = useState(0);
  const applyKind = (next: GraphKind) => {
    setKind(next); setExpressions(GRAPH_EXAMPLES[next]);
    setStart(next === 'cartesian' ? '-5' : '0');
    setEnd(next === 'cartesian' ? '5' : options.angleMode === 'RAD' ? '2*pi' : options.angleMode === 'GRAD' ? '400' : '360');
    setShade('none');
  };
  const setLine = (i: number, key: 'first' | 'second', value: string) => setExpressions((lines) => lines.map((line, index) => index === i ? { ...line, [key]: value } : line));
  return <ModeForm t={t} revision={`${lang}:${options.angleMode}:${kind}:${nonce}`} action={t('ارسم الدوال', 'Plot curves')}
    note={kind === 'cartesian' ? t('اكتب الدالة في x. ممكن تسيب المنحنى التاني أو التالت فاضي، وتظلل ناحية من أول منحنى مرسوم.', 'Use x. Leave either extra curve blank; inequality shading applies to the first plotted curve.')
      : t('اكتب t للمعامل. القطبي والدوال المثلثية بيتبعوا وحدة الزوايا الحالية.', 'Use t as the parameter. Polar and trig follow the selected angle unit.')}
    run={() => <GraphView graph={buildEngineeringGraph(kind, expressions.map((entry, i) => ({ ...entry, label: `Y${i + 1}` })), num(start, props), num(end, props), options)} shade={shade} props={props} />}>
    <CalcSelect label={t('نظام الرسم', 'Graph coordinates')} value={kind} set={applyKind} items={optionsFor(KINDS, t)} />
    {expressions.map((entry, i) => <div key={i} className={kind === 'parametric' ? 'cw-form-grid' : undefined}>
      <CalcInput label={displayDigits(`${kind === 'cartesian' ? 'y' : kind === 'polar' ? 'r' : 'x'}${i + 1}(${kind === 'cartesian' ? 'x' : 't'})`, lang)} value={entry.first} set={(v) => setLine(i, 'first', v)} />
      {kind === 'parametric' && <CalcInput label={displayDigits(`y${i + 1}(t)`, lang)} value={entry.second} set={(v) => setLine(i, 'second', v)} />}
    </div>)}
    {kind === 'cartesian' && (functions.f || functions.g) && <button type="button" className="cw-secondary" onClick={() => {
      setExpressions([{ first: functions.f ?? '', second: '' }, { first: functions.g ?? '', second: '' }, { first: '', second: '' }]);
      setNonce((n) => n + 1);
    }}>{t('استخدم f و g من الذاكرة', 'Use f and g from memory')}</button>}
    <div className="cw-form-grid"><CalcInput label={t('أول النطاق', 'Range start')} value={start} set={setStart} /><CalcInput label={t('آخر النطاق', 'Range end')} value={end} set={setEnd} /></div>
    {kind === 'cartesian' && <CalcSelect label={t('تظليل متباينة', 'Inequality shading')} value={shade} set={setShade} items={[[ 'none', t('بدون تظليل', 'No shading')], ['above', 'y ≥ f(x)'], ['below', 'y ≤ f(x)'], ['aboveStrict', 'y > f(x)'], ['belowStrict', 'y < f(x)']]} />}
  </ModeForm>;
}

function SurfaceView({ mesh, props }: { mesh: (SurfacePoint | null)[][]; props: ModeProps }) {
  const { t } = props;
  const [az, setAz] = useState(40);
  const [el, setEl] = useState(28);
  const projected = useMemo(() => {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    const extent = Math.max(1e-12, ...mesh.flatMap((row) => row.map((point) => point ? Math.hypot(...point) : 0)));
    const scale = 94 / extent;
    const project = ([x, y, z]: SurfacePoint) => {
      const h = x * Math.cos(a) - y * Math.sin(a);
      const d = x * Math.sin(a) + y * Math.cos(a);
      return { x: 158 + scale * h, y: 111 - scale * (z * Math.cos(e) - d * Math.sin(e)), depth: (d * Math.cos(e) + z * Math.sin(e)) / extent };
    };
    const rows = mesh.map((row) => row.map((p) => p ? project(p) : null));
    const lines = [...rows, ...rows[0].map((_, j) => rows.map((row) => row[j]))];
    const segments = lines.flatMap((row, direction) => row.slice(1).flatMap((b, i) => {
      const a = row[i];
      return a && b ? [{ a, b, depth: (a.depth + b.depth) / 2, color: direction < rows.length ? COLORS[0] : COLORS[2] }] : [];
    })).sort((a, b) => a.depth - b.depth);
    return { segments, origin: project([0, 0, 0]), axes: [project([extent, 0, 0]), project([0, extent, 0]), project([0, 0, extent])] };
  }, [mesh, az, el]);
  return <div className="cw-graph-result">
    <svg className="cw-plot cw-surface" viewBox="0 0 316 222" role="img" aria-label={t('شبكة السطح ثلاثي الأبعاد', 'Three-dimensional wireframe')}>
      <rect className="cw-plot-bg" width="316" height="222" rx="7" />
      {projected.axes.map((p, i) => <g key={i}><line className="cw-plot-axes" x1={projected.origin.x} y1={projected.origin.y} x2={p.x} y2={p.y} /><text className="cw-axis-name" x={p.x + 4} y={p.y - 3}>{['x', 'y', 'z'][i]}</text></g>)}
      {projected.segments.map(({ a, b, color, depth }, i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} opacity={0.38 + 0.31 * (depth + 1)} />)}
    </svg>
    <label className="cw-trace"><span>{t('لف السطح', 'Rotate surface')} · {nfmt(az, props)}°</span><input dir="ltr" type="range" min="0" max="360" value={az} onChange={(e) => setAz(Number(e.target.value))} aria-valuetext={`${nfmt(az, props)}°`} /></label>
    <label className="cw-trace"><span>{t('ميل السطح', 'Tilt surface')} · {nfmt(el, props)}°</span><input dir="ltr" type="range" min="-80" max="80" value={el} onChange={(e) => setEl(Number(e.target.value))} aria-valuetext={`${nfmt(el, props)}°`} /></label>
    <button type="button" className="cw-secondary" onClick={() => { setAz(40); setEl(28); }}>{t('ارجع للزاوية الأصلية', 'Reset rotation')} <RotateCcw size={14} /></button>
  </div>;
}
const SURFACES: Record<SurfaceKind, [string, string]> = { function: ['سطح z=f(x,y)', 'Surface z=f(x,y)'], plane: ['مستوى', 'Plane'], sphere: ['كرة', 'Sphere'], cylinder: ['أسطوانة', 'Cylinder'] };
export function SurfaceMode(props: ModeProps) {
  const { t, lang, options } = props;
  const [kind, setKind] = useState<SurfaceKind>('function');
  const [expression, setExpression] = useState('sin(x*60)+cos(y*60)');
  const [size, setSize] = useState('3');
  return <ModeForm t={t} revision={`${lang}:${options.angleMode}`} action={t('ارسم السطح', 'Plot surface')} note={t('السطح شبكة عددية. نموذج الأسطوانة ارتفاعه ضعف نصف القطر.', 'A sampled wireframe. The cylinder template is twice its radius in height.')}
    run={() => <SurfaceView mesh={engineeringSurface(kind, expression, num(size, props), options)} props={props} />}>
    <CalcSelect label={t('شكل السطح', 'Surface type')} value={kind} set={setKind} items={optionsFor(SURFACES, t)} />
    {kind === 'function' && <CalcInput label="z = f(x,y)" value={expression} set={setExpression} />}
    <CalcInput label={kind === 'sphere' || kind === 'cylinder' ? t('نصف القطر', 'Radius') : t('نصف عرض المجال', 'Half-width of domain')} value={size} set={setSize} />
  </ModeForm>;
}
