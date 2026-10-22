import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ExternalLink, Map as MapIcon, RefreshCw, Route, Trophy, TriangleAlert } from 'lucide-react';
import bundledPrecheck from '../data/live/shaheen-precheck.json';
import bundledSupervisor from '../data/live/ai-supervisor.json';
import bundledControls from '../data/owner/controls.json';
import bundledStateOrders from '../data/owner/state-orders.json';
import { readControls, type OwnerControls } from '../utils/ownerAuthority';
import { readStateOrders, type StateOrders } from '../utils/platformState';
import LiveWorkMap from './LiveWorkMap';
import { BOTS, DEPARTMENTS, botOf, deptOf, type BotId, type DeptId } from '../utils/shaheenOrg';
import { SHIFTS, shiftOfBot, type ShiftIndex } from '../../scripts/shaheen-patrol/shifts';
import type { PrecheckFile } from '../../scripts/shaheen-council/precheck';
import type { PatrolFile } from '../../scripts/shaheen-patrol/patrol';
import {
  GRADE_AT, JOURNEYS, MAP, ROOT, WEIGHTS, deptX, helpedBy, helps, journeyHealth, layout, scoreAll, shortName, summarize,
  type Grade, type ScorePart, type SupervisorFile, type ToolScore,
} from '../utils/opsMap';
import { allLive, currentStep, liveScenarios, EVENT_AR, type BotLive, type FallbackRun, type LiveState } from '../utils/opsLive';
import { useOpsLive } from './useOpsLive';

/**
 * «خريطة تشغيل شام» — Shaheen at the top, the five departments and their bots below, coloured by each bot's
 * score (src/utils/opsMap.ts). Click a bot: its duties, last run, score parts, defects with their causes, and who
 * it helps. Journeys draw how a piece of work travels through the tools. Real data only (the pre-meeting check,
 * the patrol, the supervisor's review — latest from GitHub, the bundled copy as a fallback).
 * The live layer (src/utils/opsLive.ts, useOpsLive): who runs right now and on which step, who is stopped and why,
 * who waits for its turn and when, and the scenarios moving through the tools. Admin panel only (#admin/ops).
 */
const RAW = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/';
const RAW_OWNER = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/owner/';
const REPO = 'https://github.com/spculculat-oss/Sham-Perfume';
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const ar = () => getAdminLang() === 'ar';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const name = (id: BotId) => { const b = botOf(id); return b ? (ar() ? b.nameAr : b.nameEn) : id; };
const short = (id: BotId) => { const b = botOf(id); return b ? (ar() ? shortName(b.nameAr) : b.nameEn.split(/\s+[(—]/)[0]) : id; };
const deptName = (d: DeptId) => (ar() ? deptOf(d).nameAr : deptOf(d).nameEn);
/** SVG text does not wrap: clip a label to what fits its box (the full name shows on hover and in the details). */
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const NODE_CHARS = () => 23;
const DEPT_CHARS = () => (ar() ? 30 : 28);

const isPrecheck = (d: unknown): d is PrecheckFile => Boolean(d && typeof d === 'object' && (d as PrecheckFile).version === 1 && Array.isArray((d as PrecheckFile).bots));
const isPatrol = (d: unknown): d is PatrolFile => Boolean(d && typeof d === 'object' && (d as PatrolFile).version === 1 && Array.isArray((d as PatrolFile).open));
const isSupervisor = (d: unknown): d is SupervisorFile => Boolean(d && typeof d === 'object' && (d as SupervisorFile).tools && typeof (d as SupervisorFile).tools === 'object');
const getJson = (file: string, base = RAW) => fetch(`${base}${file}?t=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

const GRADE: Record<Grade, { label: () => string; fill: string; stroke: string; text: string; chip: string; dot: string }> = {
  high: { label: () => T('كفاءة عالية'), fill: '#d1fae5', stroke: '#059669', text: '#064e3b', chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  good: { label: () => T('كويسة'), fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e', chip: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  warn: { label: () => T('محتاجة انتباه'), fill: '#fef3c7', stroke: '#d97706', text: '#78350f', chip: 'bg-amber-100 text-amber-900', dot: 'bg-amber-400' },
  fail: { label: () => T('فيها خلل'), fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d', chip: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  idle: { label: () => T('بدون بيانات'), fill: '#f5f5f4', stroke: '#a8a29e', text: '#57534e', chip: 'bg-stone-100 text-stone-600', dot: 'bg-stone-300' },
};
const PART: Record<ScorePart['key'], () => string> = {
  run: () => T('آخر تشغيل'), report: () => T('التقرير في ميعاده'), quality: () => T('جودة الشغل (تقييم المشرف)'), own: () => T('أرقامه الخاصة'), review: () => T('مراجعة الخبير بالتجربة'),
};

type Shift = 'all' | ShiftIndex;
type LiveFilter = 'all' | 'running' | 'stopped' | 'waiting';
/** The live state's look (the node's corner badge, chips). */
const LIVE: Record<LiveState, { label: () => string; color: string; chip: string }> = {
  running: { label: () => T('شغالة دلوقتي'), color: '#16a34a', chip: 'bg-emerald-600 text-white' },
  queued: { label: () => T('في الطابور'), color: '#0ea5e9', chip: 'bg-sky-500 text-white' },
  stopped: { label: () => T('واقفة'), color: '#dc2626', chip: 'bg-red-600 text-white' },
  paused: { label: () => T('موقوفة بأمر'), color: '#d97706', chip: 'bg-amber-500 text-white' },
  waiting: { label: () => T('مستنية دورها'), color: '#78716c', chip: 'bg-stone-200 text-stone-800' },
  ondemand: { label: () => T('عند الطلب'), color: '#a8a29e', chip: 'bg-stone-100 text-stone-600' },
  unknown: { label: () => T('مش معروف'), color: '#d6d3d1', chip: 'bg-stone-100 text-stone-500' },
};
const ago = (iso?: string, now = Date.now()) => {
  if (!iso || !(Date.parse(iso) > 0)) return '—';
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return m < 60 ? TP('من {n} دقيقة', { n: m }) : TP('من {n} ساعة', { n: Math.round(m / 60) });
};
const time = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleTimeString(adminLocale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '—');
const POS = layout();
const posOf = (id: BotId) => POS.find((p) => p.id === id)!;

/** A curve between two nodes: side to side across columns, around the outside within a column. */
function edgePath(a: BotId, b: BotId): string {
  const p = posOf(a); const q = posOf(b); const w = MAP.nodeW / 2;
  if (p.x === q.x) {
    const x = p.x - w; const bend = 34 + Math.abs(p.y - q.y) * 0.12;
    return `M ${x} ${p.y} C ${x - bend} ${p.y}, ${x - bend} ${q.y}, ${x} ${q.y}`;
  }
  const dir = q.x > p.x ? 1 : -1; const x1 = p.x + dir * w; const x2 = q.x - dir * w; const mid = (x1 + x2) / 2;
  return `M ${x1} ${p.y} C ${mid} ${p.y}, ${mid} ${q.y}, ${x2} ${q.y}`;
}

export default function ShaheenOpsMapPanel() {
  const [precheck, setPrecheck] = useState<PrecheckFile | null>(isPrecheck(bundledPrecheck) ? bundledPrecheck : null);
  const [patrol, setPatrol] = useState<PatrolFile | null>(null);
  const [supervisor, setSupervisor] = useState<SupervisorFile | null>(isSupervisor(bundledSupervisor) ? bundledSupervisor : null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BotId | null>(null);
  const [journey, setJourney] = useState<string | null>(null);
  const [dept, setDept] = useState<DeptId | 'all'>('all');
  const [shift, setShift] = useState<Shift>('all');
  const [defectsOnly, setDefectsOnly] = useState(false);
  const [liveFilter, setLiveFilter] = useState<LiveFilter>('all');
  const gh = useOpsLive();
  const [controls, setControls] = useState<OwnerControls>(() => readControls(bundledControls));
  const [stateOrders, setStateOrders] = useState<StateOrders>(() => readStateOrders(bundledStateOrders));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getJson('shaheen-precheck.json'), getJson('shaheen-patrol.json'), getJson('ai-supervisor.json'), getJson('controls.json', RAW_OWNER), getJson('state-orders.json', RAW_OWNER)])
      .then(([p, q, s, c, o]) => {
        if (isPrecheck(p)) setPrecheck(p); if (isPatrol(q)) setPatrol(q); if (isSupervisor(s)) setSupervisor(s);
        // Who is paused on purpose (the owner's switches, «دولة المنصة»'s orders): the latest from GitHub.
        if (c) setControls(readControls(c)); if (o) setStateOrders(readStateOrders(o));
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const scores = useMemo(() => scoreAll({ precheck, patrol, supervisor }), [precheck, patrol, supervisor]);
  const sum = useMemo(() => summarize(scores), [scores]);
  const scoreOf = (id: BotId) => scores.find((s) => s.id === id)!;
  const fallback = useMemo(() => Object.fromEntries((precheck?.bots || []).filter((b) => b.lastRun).map((b) => [b.id, b.lastRun as FallbackRun])) as Partial<Record<BotId, FallbackRun>>, [precheck]);
  const live = useMemo(() => allLive({ runs: gh.runs, workflows: gh.workflows, fallback, now: gh.at || now, controls, stateOrders }), [gh.runs, gh.workflows, gh.at, fallback, now, controls, stateOrders]);
  const liveOf = (id: BotId) => live.find((l) => l.id === id)!;
  const scenarios = useMemo(() => liveScenarios(live), [live]);
  const stepOf = (l: BotLive) => (l.run ? currentStep(gh.jobs[l.run.id] || []) : undefined);
  const count = (st: LiveState[]) => live.filter((l) => st.includes(l.state)).length;
  const j = JOURNEYS.find((x) => x.id === journey);
  const visible = (id: BotId) => {
    const b = botOf(id)!; const g = scoreOf(id).grade;
    if (dept !== 'all' && b.dept !== dept) return false;
    if (shift !== 'all' && shiftOfBot(id) !== shift) return false;
    if (defectsOnly && g !== 'fail' && g !== 'warn') return false;
    if (j && !j.steps.some((s) => s.bot === id)) return false;
    const st = liveOf(id).state;
    if (liveFilter === 'running' && st !== 'running' && st !== 'queued') return false;
    if (liveFilter === 'stopped' && st !== 'stopped') return false;
    if (liveFilter === 'waiting' && st !== 'waiting') return false;
    return true;
  };
  const pick = (id: BotId) => { setSelected(id); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50); };
  const sel = selected ? scoreOf(selected) : null;
  const latest = [precheck?.updatedAt, patrol?.updatedAt, supervisor?.updatedAt].filter(Boolean).sort().pop();

  // Edges to draw: the selected bot's links, or the journey's path.
  const edges: { from: BotId; to: BotId; kind: 'out' | 'in' | 'journey'; n?: number }[] = j
    ? j.steps.slice(1).map((s, i) => ({ from: j.steps[i].bot, to: s.bot, kind: 'journey' as const, n: i + 1 }))
    : selected ? [...helps(selected).map((l) => ({ from: l.from, to: l.to, kind: 'out' as const })), ...helpedBy(selected).map((l) => ({ from: l.from, to: l.to, kind: 'in' as const }))] : [];
  const lit = new Set<BotId>(edges.flatMap((e) => [e.from, e.to]));

  const btn = (on: boolean) => `rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? 'border-stone-900 bg-stone-900 text-amber-100' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`;

  return (
    <div className="space-y-3" dir={ar() ? 'rtl' : 'ltr'}>
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black text-stone-900"><MapIcon className="h-5 w-5 text-amber-700" />{T('خريطة تشغيل شام')}</h3>
          <button type="button" onClick={() => { load(); gh.refresh(); }} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700"><RefreshCw className={`h-3.5 w-3.5 ${loading || gh.loading ? 'animate-spin' : ''}`} />{T('تحديث')}</button>
        </div>
        <p className="mt-1 text-xs text-stone-500">{T('شاهين فوق، وتحته الأقسام الخمسة وأدواتها. لون كل أداة = تقييمها من 100 من بيانات حقيقية (آخر تشغيل، التقرير، جودة الشغل، مراجعة الخبير). دوس على أي أداة تشوف تفاصيلها، أو اختار رحلة تشوف الشغل ماشي إزاي.')}</p>
        <p className="mt-1 text-[11px] text-stone-500">{TP('آخر بيانات: {when}', { when: when(latest) })}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <div className="rounded-xl bg-stone-900 p-2 text-amber-100"><b className="block text-lg">{sum.average ?? '—'}</b><span className="text-[10px]">{T('متوسط التقييم')}</span></div>
          {(['high', 'good', 'warn', 'fail', 'idle'] as Grade[]).map((g) => (
            <div key={g} className={`rounded-xl p-2 ${GRADE[g].chip}`}><b className="block text-lg">{sum[g].length}</b><span className="text-[10px]">{GRADE[g].label()}</span></div>
          ))}
        </div>

        <LiveWorkMap live={live} gh={gh} stepOf={stepOf} now={now} onPick={pick} />

        <LiveNow live={live} scenarios={scenarios} stepOf={stepOf} gh={gh} now={now} onPick={pick} onJourney={(id) => { setJourney(id); setSelected(null); }}
          counts={{ running: count(['running', 'queued']), stopped: count(['stopped']), waiting: count(['waiting']) }} />

        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-stone-500">{T('القسم')}:</span>
            <button type="button" className={btn(dept === 'all')} onClick={() => setDept('all')}>{T('الكل')}</button>
            {DEPARTMENTS.map((d) => <button type="button" key={d.id} className={btn(dept === d.id)} onClick={() => setDept(d.id)}>{deptName(d.id)}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-stone-500">{T('الوردية')}:</span>
            <button type="button" className={btn(shift === 'all')} onClick={() => setShift('all')}>{T('الكل')}</button>
            {SHIFTS.map((x) => <button type="button" key={x.index} className={btn(shift === x.index)} onClick={() => setShift(x.index)}>{ar() ? x.nameAr : x.nameEn}</button>)}
            <button type="button" className={btn(defectsOnly)} onClick={() => setDefectsOnly((v) => !v)}><TriangleAlert className="me-1 inline h-3 w-3" />{T('الأعطال بس')}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-stone-500"><Activity className="me-1 inline h-3.5 w-3.5" />{T('الحالة الآن')}:</span>
            {(['all', 'running', 'stopped', 'waiting'] as LiveFilter[]).map((f) => (
              <button type="button" key={f} className={btn(liveFilter === f)} onClick={() => setLiveFilter(f)}>{f === 'all' ? T('الكل') : f === 'running' ? T('شغالة دلوقتي') : f === 'stopped' ? T('واقفة') : T('مستنية دورها')}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-stone-500"><Route className="me-1 inline h-3.5 w-3.5" />{T('رحلة')}:</span>
            <button type="button" className={btn(!journey)} onClick={() => setJourney(null)}>{T('بدون')}</button>
            {JOURNEYS.map((x) => {
              const h = journeyHealth(x, scores);
              return <button type="button" key={x.id} className={btn(journey === x.id)} onClick={() => { setJourney(x.id); setSelected(null); }}><span className={`me-1 inline-block h-2 w-2 rounded-full ${GRADE[h.grade].dot}`} />{ar() ? x.nameAr : x.nameEn}</button>;
            })}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-stone-100 bg-stone-50/60">
          <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="block h-auto w-full min-w-[760px]" role="img" aria-label={T('خريطة تشغيل شام')} direction="ltr" style={{ fontFamily: 'inherit', direction: 'ltr' }}>
            <defs>
              {(['out', 'in', 'journey'] as const).map((k) => (
                <marker key={k} id={`ops-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={k === 'out' ? '#b45309' : k === 'in' ? '#0369a1' : '#7c3aed'} />
                </marker>
              ))}
            </defs>
            {/* Shaheen → departments */}
            <g>
              <rect x={ROOT.x - 150} y={ROOT.y - 28} width={300} height={56} rx={16} fill="#1c1917" />
              <text x={ROOT.x} y={ROOT.y - 4} textAnchor="middle" fontSize={17} fontWeight={800} fill="#fde68a">{T('الخبير شاهين')}</text>
              <text x={ROOT.x} y={ROOT.y + 16} textAnchor="middle" fontSize={11} fill="#e7e5e4">{T('المدير العام — كل الأدوات تحت مظلته')}</text>
            </g>
            {DEPARTMENTS.map((d) => {
              const x = deptX(d.id); const bots = BOTS.filter((b) => b.dept === d.id); const avg = (() => { const s = bots.map((b) => scoreOf(b.id).score).filter((v): v is number => v !== null); return s.length ? Math.round(s.reduce((a, v) => a + v, 0) / s.length) : null; })();
              return (
                <g key={d.id} opacity={dept === 'all' || dept === d.id ? 1 : 0.25}>
                  <path d={`M ${ROOT.x} ${ROOT.y + 28} C ${ROOT.x} ${110}, ${x} ${100}, ${x} ${138}`} stroke="#a8a29e" strokeWidth={1.5} fill="none" />
                  <rect x={x - MAP.nodeW / 2} y={138} width={MAP.nodeW} height={44} rx={12} fill="#fffbeb" stroke="#d6a84a" />
                  <text x={x} y={157} textAnchor="middle" fontSize={12} fontWeight={800} fill="#78350f"><title>{deptName(d.id)}</title>{fit(deptName(d.id), DEPT_CHARS())}</text>
                  <text x={x} y={174} textAnchor="middle" fontSize={10.5} fill="#92400e">{avg === null ? T('بدون بيانات') : TP('متوسط {n} من 100', { n: avg })}</text>
                  <line x1={x} y1={182} x2={x} y2={MAP.top + (bots.length - 1) * MAP.gap} stroke="#e7e5e4" strokeWidth={2} />
                </g>
              );
            })}
            {/* Cooperation edges */}
            {edges.map((e, i) => {
              const color = e.kind === 'out' ? '#b45309' : e.kind === 'in' ? '#0369a1' : '#7c3aed';
              const p = posOf(e.from); const q = posOf(e.to);
              return (
                <g key={`${e.from}-${e.to}-${i}`}>
                  <path d={edgePath(e.from, e.to)} stroke={color} strokeWidth={e.kind === 'journey' ? 3 : 2} fill="none" markerEnd={`url(#ops-arrow-${e.kind})`} opacity={0.9} />
                  {e.n && <g><circle cx={(p.x + q.x) / 2} cy={(p.y + q.y) / 2} r={11} fill="#7c3aed" /><text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">{e.n}</text></g>}
                </g>
              );
            })}
            {/* Bots */}
            {POS.map((p) => {
              const s = scoreOf(p.id); const g = GRADE[s.grade]; const on = visible(p.id); const isSel = selected === p.id;
              return (
                <g key={p.id} role="button" tabIndex={0} aria-label={`${name(p.id)} — ${s.score ?? T('بدون بيانات')}`} onClick={() => pick(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p.id); } }}
                  style={{ cursor: 'pointer' }} opacity={on ? (edges.length && !lit.has(p.id) ? 0.35 : 1) : 0.15}>
                  <title>{`${name(p.id)} — ${s.score ?? T('بدون بيانات')} · ${GRADE[s.grade].label()} · ${LIVE[liveOf(p.id).state].label()}`}</title>
                  <rect x={p.x - MAP.nodeW / 2} y={p.y - MAP.nodeH / 2} width={MAP.nodeW} height={MAP.nodeH} rx={10} fill={g.fill} stroke={isSel ? '#1c1917' : g.stroke} strokeWidth={isSel ? 3 : 1.5} />
                  <text x={p.x + (ar() ? MAP.nodeW / 2 - 10 : -MAP.nodeW / 2 + 10)} y={p.y + 4} textAnchor={ar() ? 'end' : 'start'} fontSize={11.5} fontWeight={700} fill={g.text}>{fit(short(p.id), NODE_CHARS())}</text>
                  <rect x={p.x + (ar() ? -MAP.nodeW / 2 + 6 : MAP.nodeW / 2 - 40)} y={p.y - 11} width={34} height={22} rx={11} fill={g.stroke} />
                  <text x={p.x + (ar() ? -MAP.nodeW / 2 + 23 : MAP.nodeW / 2 - 23)} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">{s.score ?? '—'}</text>
                  <LiveBadge state={liveOf(p.id).state} x={p.x + (ar() ? MAP.nodeW / 2 - 3 : -MAP.nodeW / 2 + 3)} y={p.y - MAP.nodeH / 2 + 3} />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone-600">
          {(['high', 'good', 'warn', 'fail', 'idle'] as Grade[]).map((g) => <span key={g} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${GRADE[g].dot}`} />{GRADE[g].label()}</span>)}
          <span className="inline-flex items-center gap-1"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" /></span>{T('شغالة دلوقتي')}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" />{T('واقفة')}</span>
          {selected && !j && <><span className="text-amber-700">━ {T('بيساعد')}</span><span className="text-sky-700">━ {T('بيستقبل مساعدة من')}</span></>}
        </div>
      </div>

      {j && (
        <div className={card}>
          <h4 className="flex items-center gap-2 text-sm font-black text-stone-900"><Route className="h-4 w-4 text-violet-700" />{ar() ? j.nameAr : j.nameEn}</h4>
          {(() => { const h = journeyHealth(j, scores); return h.weakest && (h.grade === 'fail' || h.grade === 'warn') ? <p className="mt-1 text-xs text-red-700">{TP('أضعف خطوة: {name}', { name: name(h.weakest) })}</p> : null; })()}
          <ol className="mt-2 space-y-1.5 text-xs">
            {j.steps.map((s, i) => { const sc = scoreOf(s.bot); return (
              <li key={`${s.bot}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 px-2 py-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">{i + 1}</span>
                <button type="button" className="font-bold text-stone-900 underline-offset-2 hover:underline" onClick={() => pick(s.bot)}>{name(s.bot)}</button>
                <span className="text-stone-600">— {ar() ? s.ar : s.en}</span>
                {(() => { const l = liveOf(s.bot); return l.state === 'running' || l.state === 'queued' || l.state === 'stopped' ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LIVE[l.state].chip}`}>{LIVE[l.state].label()}</span> : null; })()}
                <span className={`ms-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${GRADE[sc.grade].chip}`}>{sc.score ?? '—'} · {GRADE[sc.grade].label()}</span>
                {sc.lastRunAt && <span className="text-[10px] text-stone-500">{TP('آخر تشغيل: {when}', { when: when(sc.lastRunAt) })}</span>}
              </li>); })}
          </ol>
        </div>
      )}

      <div ref={detailRef}>{sel && <Detail s={sel} live={liveOf(sel.id)} step={stepOf(liveOf(sel.id))} now={now} onPick={pick} />}</div>

      <Ranking scores={scores} live={liveOf} visible={visible} onPick={pick} />
    </div>
  );
}

function Detail({ s, live, step, now, onPick }: { s: ToolScore; live: BotLive; step?: ReturnType<typeof currentStep>; now: number; onPick: (id: BotId) => void }) {
  const b = botOf(s.id)!;
  const total = s.parts.reduce((a, p) => a + p.weight, 0);
  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-stone-900">{name(s.id)}</h4>
          <p className="text-[11px] text-stone-500">{deptName(b.dept)} · {(() => { const x = SHIFTS.find((y) => y.index === shiftOfBot(s.id))!; return ar() ? x.nameAr : x.nameEn; })()}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-black ${GRADE[s.grade].chip}`}>{s.score ?? '—'}{s.score !== null ? ' / 100' : ''} · {GRADE[s.grade].label()}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${LIVE[live.state].chip}`}>{LIVE[live.state].label()}</span>
        {ar() && <span className="text-stone-700">{live.noteAr}</span>}
        {step?.step && <span className="text-emerald-800">{TP('الخطوة الحالية: «{step}» ({done} من {total})', { step: step.step, done: step.done + 1, total: step.total })}</span>}
        {live.state === 'running' && live.since && <span className="text-stone-500">{TP('بدأت {ago}', { ago: ago(live.since, now) })}</span>}
        {live.next && <span className="text-stone-500">{TP('الدور الجاي: {time}', { time: time(live.next) })}</span>}
        {live.run && <a className="inline-flex items-center gap-1 font-bold text-amber-800 hover:underline" href={live.run.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />{T('تابع التشغيل')}</a>}
      </div>
      {ar() && <p className="mt-2 text-xs text-stone-700"><b>{T('مهامه')}:</b> {b.dutiesAr}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone-600">
        <span>{TP('آخر تشغيل: {when}', { when: when(s.lastRunAt) })}{s.lastRunAt ? (s.lastRunOk ? ` ✅` : ` ❌`) : ''}</span>
        {s.reportAt && <span>{TP('آخر تقرير: {when}', { when: when(s.reportAt) })}</span>}
        {s.runUrl && <a className="inline-flex items-center gap-1 font-bold text-amber-800 hover:underline" href={s.runUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />{T('سجل التشغيل')}</a>}
        {b.workflow && !s.runUrl && <a className="inline-flex items-center gap-1 font-bold text-amber-800 hover:underline" href={`${REPO}/actions/workflows/${b.workflow}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />{T('سجل التشغيل')}</a>}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <b className="text-xs text-stone-700">{T('التقييم اتحسب إزاي')}</b>
          {!s.parts.length ? <p className="mt-1 text-xs text-stone-500">{T('بدون بيانات — الأداة دي لسه ماشتغلتش أو مالهاش تقرير، فمش هنحط لها رقم من عندنا.')}</p> : (
            <ul className="mt-1 space-y-1 text-[11px]">
              {s.parts.map((p) => (
                <li key={p.key} className="rounded-lg border border-stone-100 px-2 py-1">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold text-stone-800">{PART[p.key]()}</span><span className="text-stone-500">{Math.round(p.points * 100)}% × {Math.round((100 * p.weight) / total)}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className={`h-full ${p.points >= 0.85 ? 'bg-emerald-500' : p.points >= 0.5 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.round(p.points * 100)}%` }} /></div>
                  {ar() && <p className="mt-0.5 text-stone-500">{p.noteAr}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          {s.causes.length > 0 && (
            <div className="rounded-xl bg-red-50 p-2">
              <b className="text-xs text-red-800">{T('المشاكل وأسبابها')}{s.owner ? ` — ${T('محتاج قرارك')}` : ''}</b>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[11px] text-red-900">{s.causes.slice(0, 8).map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          {s.strengths.length > 0 && (
            <div className="rounded-xl bg-emerald-50 p-2">
              <b className="text-xs text-emerald-800">{T('نقط القوة')}</b>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[11px] text-emerald-900">{s.strengths.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-[11px] md:grid-cols-2">
        <div><b className="text-stone-700">{T('بيساعد')}</b>
          <ul className="mt-1 space-y-0.5">{helps(s.id).map((l) => <li key={l.to}><button type="button" className="font-bold text-amber-800 hover:underline" onClick={() => onPick(l.to)}>{name(l.to)}</button>{ar() && <span className="text-stone-500"> — {l.whyAr}</span>}</li>)}{!helps(s.id).length && <li className="text-stone-400">—</li>}</ul>
        </div>
        <div><b className="text-stone-700">{T('بيستقبل مساعدة من')}</b>
          <ul className="mt-1 space-y-0.5">{helpedBy(s.id).map((l) => <li key={l.from}><button type="button" className="font-bold text-sky-800 hover:underline" onClick={() => onPick(l.from)}>{name(l.from)}</button>{ar() && <span className="text-stone-500"> — {l.whyAr}</span>}</li>)}{!helpedBy(s.id).length && <li className="text-stone-400">—</li>}</ul>
        </div>
      </div>
    </div>
  );
}

function Ranking({ scores, live, visible, onPick }: { scores: ToolScore[]; live: (id: BotId) => BotLive; visible: (id: BotId) => boolean; onPick: (id: BotId) => void }) {
  const rows = scores.filter((s) => visible(s.id));
  return (
    <div className={card}>
      <h4 className="flex items-center gap-2 text-sm font-black text-stone-900"><Trophy className="h-4 w-4 text-amber-600" />{T('ترتيب الأدوات')}</h4>
      <p className="mt-1 text-[11px] text-stone-500">{TP('التقييم من 100: آخر تشغيل {run}%، جودة الشغل {quality}%، التقرير {report}%، أرقامه {own}%، مراجعة الخبير {review}% — الجزء اللي مالوش بيانات مايتحسبش. {high}+ كفاءة عالية، {good}+ كويسة، {warn}+ محتاجة انتباه، أقل = فيها خلل.', { ...WEIGHTS, ...GRADE_AT })}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[620px] text-start text-xs">
          <thead><tr className="border-b border-stone-200 text-[11px] text-stone-500"><th className="py-1.5 text-start">#</th><th className="text-start">{T('الأداة')}</th><th className="text-start">{T('التقييم')}</th><th className="text-start">{T('الحالة الآن')}</th><th className="text-start">{T('أهم سبب')}</th></tr></thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} className="cursor-pointer border-b border-stone-100 hover:bg-amber-50/50" onClick={() => onPick(s.id)}>
                <td className="py-1.5 text-stone-400">{i + 1}</td>
                <td className="py-1.5"><b className="text-stone-900">{name(s.id)}</b><span className="block text-[10px] text-stone-500">{deptName(botOf(s.id)!.dept)}</span></td>
                <td className="py-1.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${GRADE[s.grade].chip}`}><span className={`h-2 w-2 rounded-full ${GRADE[s.grade].dot}`} />{s.score ?? '—'} · {GRADE[s.grade].label()}</span></td>
                <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LIVE[live(s.id).state].chip}`}>{LIVE[live(s.id).state].label()}</span></td>
                <td className="max-w-[360px] py-1.5 text-[11px] text-stone-600">{s.grade === 'idle' ? T('لسه مفيش تشغيل ولا تقرير يتقاس عليه') : s.causes[0] || (s.strengths[0] ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The node's corner badge: a pulsing green dot while running, a red square when stopped, a grey dot when waiting. */
function LiveBadge({ state, x, y }: { state: LiveState; x: number; y: number }) {
  if (state === 'ondemand' || state === 'unknown') return null;
  const c = LIVE[state].color;
  if (state === 'stopped') return <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} fill={c} stroke="#fff" strokeWidth={2} />;
  return (
    <g>
      {(state === 'running' || state === 'queued') && (
        <circle cx={x} cy={y} r={7} fill={c} opacity={0.5}>
          <animate attributeName="r" values="6;13;6" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={x} cy={y} r={6} fill={c} stroke="#fff" strokeWidth={2} />
    </g>
  );
}

/** «دلوقتي»: who runs right now (and on which step), the scenarios moving, and who is stopped. */
function LiveNow({ live, scenarios, stepOf, gh, now, counts, onPick, onJourney }: {
  live: BotLive[]; scenarios: ReturnType<typeof liveScenarios>; stepOf: (l: BotLive) => ReturnType<typeof currentStep>;
  gh: ReturnType<typeof useOpsLive>; now: number; counts: { running: number; stopped: number; waiting: number };
  onPick: (id: BotId) => void; onJourney: (id: string) => void;
}) {
  const running = live.filter((l) => l.state === 'running' || l.state === 'queued');
  // One line per running workflow (bots sharing a workflow run together).
  const runs = [...new Map(running.map((l) => [l.run?.id ?? l.id, l])).values()];
  const stopped = live.filter((l) => l.state === 'stopped');
  const nextUp = live.filter((l) => l.state === 'waiting' && l.next).sort((a, b) => a.next!.localeCompare(b.next!))[0];
  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="flex items-center gap-2 text-sm text-stone-900"><Activity className="h-4 w-4 text-emerald-700" />{T('دلوقتي على الموقع')}</b>
        <span className="text-[11px] text-stone-500">
          {gh.limitedUntil ? TP('التحديث المباشر واقف مؤقتاً لحد {time} (حد القراءة من جيت هب) — الخريطة شغالة من آخر تقارير', { time: time(new Date(gh.limitedUntil).toISOString()) })
            : gh.error ? T('تعذّر الوصول لسجل التشغيل — الخريطة شغالة من آخر تقارير')
            : gh.at ? TP('بيتحدّث لوحده كل {n} ثانية — آخر تحديث {ago}', { n: Math.round(gh.everyMs / 1000), ago: ago(new Date(gh.at).toISOString(), now) }) : T('بيحمّل الحالة المباشرة…')}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-600 p-2 text-white"><b className="block text-lg">{counts.running}</b><span className="text-[10px]">{T('شغالة دلوقتي')}</span></div>
        <div className="rounded-xl bg-red-600 p-2 text-white"><b className="block text-lg">{counts.stopped}</b><span className="text-[10px]">{T('واقفة')}</span></div>
        <div className="rounded-xl bg-stone-200 p-2 text-stone-800"><b className="block text-lg">{counts.waiting}</b><span className="text-[10px]">{T('مستنية دورها')}</span></div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <b className="text-xs text-stone-700">{T('السيناريو الشغال')}</b>
          {!scenarios.length ? <p className="mt-1 text-[11px] text-stone-500">{running.length ? T('أدوات شغالة لوحدها، مش جزء من رحلة دلوقتي') : T('مفيش سيناريو شغال اللحظة دي — كل الأدوات مستنية دورها')}</p> : (
            <ul className="mt-1 space-y-1.5">
              {scenarios.map((x) => (
                <li key={x.journey.id} className="rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-[11px]">
                  <button type="button" className="font-bold text-violet-800 hover:underline" onClick={() => onJourney(x.journey.id)}>{ar() ? x.journey.nameAr : x.journey.nameEn}</button>
                  <span className="text-stone-600"> — {TP('الخطوة {n} من {total}: {name}', { n: x.step + 1, total: x.journey.steps.length, name: name(x.bot) })}</span>
                  <div className="mt-1 flex gap-0.5">{x.journey.steps.map((s, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < x.step ? 'bg-violet-400' : i === x.step ? 'animate-pulse bg-emerald-500' : 'bg-stone-200'}`} title={name(s.bot)} />)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <b className="text-xs text-stone-700">{T('شغالة دلوقتي')}</b>
          {!runs.length ? <p className="mt-1 text-[11px] text-stone-500">{nextUp ? TP('مفيش أداة شغالة دلوقتي — اللي عليها الدور: {name} الساعة {time}', { name: name(nextUp.id), time: time(nextUp.next) }) : T('مفيش أداة شغالة دلوقتي')}</p> : (
            <ul className="mt-1 space-y-1">
              {runs.map((l) => { const st = stepOf(l); const together = running.filter((x) => x.run && x.run.id === l.run?.id); return (
                <li key={l.run?.id ?? l.id} className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[11px]">
                  <span className="me-1 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {together.map((x, i) => <span key={x.id}>{i > 0 && ' + '}<button type="button" className="font-bold text-stone-900 hover:underline" onClick={() => onPick(x.id)}>{name(x.id)}</button></span>)}
                  <span className="text-stone-500"> · {l.run ? (ar() ? EVENT_AR[l.run.event] || l.run.event : l.run.event) : ''} · {TP('بدأت {ago}', { ago: ago(l.since, now) })}</span>
                  {st?.step && <span className="block text-emerald-800">{TP('الخطوة الحالية: «{step}» ({done} من {total})', { step: st.step, done: st.done + 1, total: st.total })}</span>}
                </li>); })}
            </ul>
          )}
        </div>
      </div>
      {stopped.length > 0 && (
        <div className="mt-2">
          <b className="text-xs text-red-800">{T('واقفة ومحتاجة متابعة')}</b>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {stopped.map((l) => <li key={l.id}><button type="button" onClick={() => onPick(l.id)} className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[11px] text-red-800 hover:bg-red-50" title={l.noteAr}>{name(l.id)}{ar() ? ` — ${l.noteAr.replace(/^واقفة: /, '')}` : ''}</button></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
