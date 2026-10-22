import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Radio } from 'lucide-react';
import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import type { useOpsLive } from './useOpsLive';
import { botOf, type BotId } from '../utils/shaheenOrg';
import { activityFeed, stepAr, type BotLive, type currentStep, type LiveState } from '../utils/opsLive';
import { EDGES, HIERARCHY, ROOM, SCHOOL_BOTS, edgePathRoom, nodeOf, type HNode } from '../utils/opsHierarchy';
import { SCIENCE_SYLLABUS } from '../data/sciences/syllabus';
import { SCIENCE_LESSONS } from '../data/sciences';
import type { SchoolFile } from '../../scripts/shaheen-school/school';
import type { SciencesFile } from '../../scripts/shaheen-school/sciences';

/**
 * «غرفة التحكم الحية» (the owner's request, 2026-10-22: «شاشة احترافية فيها شغل حركي بكل اللي بيتم»): the platform's
 * hierarchy (src/utils/opsHierarchy.ts — owner → «دولة المنصة» → Shaheen and his agent → the departments and the school
 * → every robot and the seventeen experts) on a dark screen where the work moves: a robot working glows and pulses, its
 * report travels up to its department and to Shaheen, the State's approvals travel down, and while the school runs the
 * questions go from the school to the experts and the reviewed lessons come back and enter Shaheen's memory. Counters,
 * what is running this minute, and a live activity log. It reads the same live layer as the map (useOpsLive, no extra
 * reads) and the school's published reports. Honors «reduce motion» (no moving particles, only the lit paths).
 * Management only: rendered inside the operations map, behind the admin code / the owner's suite.
 */
type Step = ReturnType<typeof currentStep>;
const ar = () => getAdminLang() === 'ar';
const label = (n: HNode) => (ar() ? n.labelAr : n.labelEn);
const botName = (id: BotId) => { const b = botOf(id); return b ? (ar() ? b.nameAr : b.nameEn) : id; };
const clock = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleTimeString(adminLocale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '—');

const COLOR: Record<LiveState, string> = {
  running: '#22c55e', queued: '#38bdf8', stopped: '#ef4444', paused: '#f59e0b', waiting: '#64748b', ondemand: '#475569', unknown: '#334155',
};
const BOX: Record<string, { w: number; h: number; fill: string; stroke: string; text: string; size: number }> = {
  owner: { w: 190, h: 36, fill: '#422006', stroke: '#facc15', text: '#fef9c3', size: 15 },
  state: { w: 200, h: 34, fill: '#3b0764', stroke: '#c084fc', text: '#f3e8ff', size: 14 },
  shaheen: { w: 230, h: 34, fill: '#052e16', stroke: '#4ade80', text: '#dcfce7', size: 13.5 },
  agent: { w: 190, h: 34, fill: '#082f49', stroke: '#38bdf8', text: '#e0f2fe', size: 13.5 },
  school: { w: 220, h: 34, fill: '#1e1b4b', stroke: '#818cf8', text: '#e0e7ff', size: 13.5 },
  dept: { w: 120, h: 32, fill: '#0f172a', stroke: '#475569', text: '#e2e8f0', size: 11.5 },
};

/** Which expert a studied question belongs to (the syllabus, then the written lessons); perfume otherwise. */
const FIELD_OF_Q = new Map<string, string>([
  ...Object.entries(SCIENCE_SYLLABUS).flatMap(([f, qs]) => qs.map((q) => [q, f] as [string, string])),
  ...SCIENCE_LESSONS.map((l) => [l.questionAr, l.track] as [string, string]),
]);
const fieldOfQ = (q: string) => FIELD_OF_Q.get(q) || 'perfume';

/** «Reduce motion» from the system: no moving particles, no pulsing. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** A number that counts up to its new value (instant with reduced motion). */
function CountUp({ value, still }: { value: number; still: boolean }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (still) { setShown(value); from.current = value; return undefined; }
    const start = performance.now(); const a = from.current; let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setShown(Math.round(a + (value - a) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, still]);
  return <>{shown.toLocaleString(adminLocale())}</>;
}

/** A dot travelling along a path, again and again. */
function Particle({ d, color, dur, delay, r = 3 }: { d: string; color: string; dur: number; delay: number; r?: number }) {
  return (
    <circle r={r} fill={color} opacity={0}>
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={d} />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  );
}

/** Reverse of a «M a C c1, c2, b» path: the same curve walked upwards (reports going up). */
const reversePath = (d: string) => {
  const m = d.match(/^M ([\d.-]+) ([\d.-]+) C ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+), ([\d.-]+) ([\d.-]+)$/);
  return m ? `M ${m[7]} ${m[8]} C ${m[5]} ${m[6]}, ${m[3]} ${m[4]}, ${m[1]} ${m[2]}` : d;
};
/** Split a label into two short lines for the experts' circles. */
const twoLines = (s: string, max = 13): [string, string?] => {
  if (s.length <= max) return [s];
  const words = s.split(/\s+/); let a = '';
  for (const w of words) { if ((a ? `${a} ${w}` : w).length > max && a) break; a = a ? `${a} ${w}` : w; }
  const b = s.slice(a.length).trim();
  return [a, b.length > max + 2 ? `${b.slice(0, max + 1)}…` : b || undefined];
};

export default function OpsControlRoom({ live, gh, stepOf, school, sciences, now, onPick }: {
  live: BotLive[]; gh: ReturnType<typeof useOpsLive>; stepOf: (l: BotLive) => Step | undefined;
  school: SchoolFile | null; sciences: SciencesFile | null; now: number; onPick: (id: BotId) => void;
}) {
  const still = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void box.current?.requestFullscreen?.().catch(() => undefined);
  };

  const stateOf = useMemo(() => new Map(live.map((l) => [l.id, l])), [live]);
  const isOn = (id: BotId) => stateOf.get(id)?.state === 'running' || stateOf.get(id)?.state === 'queued';
  const running = live.filter((l) => l.state === 'running');
  const queued = live.filter((l) => l.state === 'queued');
  const stopped = live.filter((l) => l.state === 'stopped');
  const schoolOn = SCHOOL_BOTS.some(isOn);
  const nodeOn = (n: HNode) => n.bots.some(isOn);

  // Experts who learned something in the last 3 hours shine gold.
  const freshFields = useMemo(() => {
    const out = new Set<string>();
    for (const s of school?.lastStudied || []) if (now - Date.parse(s.at) < 3 * 3_600_000) out.add(fieldOfQ(s.q));
    for (const s of sciences?.lastLearned || []) if (now - Date.parse(s.at) < 3 * 3_600_000) out.add(fieldOfQ(s.q));
    return out;
  }, [school, sciences, now]);
  const progressOf = (field?: string) => {
    if (field === 'perfume') return school?.reliance.total ? school.reliance.covered / school.reliance.total : 0;
    const t = sciences?.tracks.find((x) => x.id === field);
    return t && t.total ? t.covered / t.total : 0;
  };

  // The moving work: which lines are lit, with what flows along them.
  const flows = useMemo(() => {
    const out: { key: string; d: string; color: string; dur: number; delay: number }[] = [];
    const lit = new Set<string>();
    const up = (from: string, to: string, color: string, i: number) => { const d = reversePath(edgePathRoom(to, from)); lit.add(`${to}>${from}`); out.push({ key: `u${from}${to}${i}`, d, color, dur: 2.2, delay: (i % 5) * 0.37 }); };
    const down = (from: string, to: string, color: string, i: number) => { const d = edgePathRoom(from, to); lit.add(`${from}>${to}`); out.push({ key: `d${from}${to}${i}`, d, color, dur: 2.4, delay: (i % 5) * 0.41 }); };
    let i = 0;
    for (const l of live) {
      if (l.state !== 'running' && l.state !== 'queued') continue;
      const color = l.state === 'running' ? '#4ade80' : '#7dd3fc';
      // The top seats: the owner's orders and the State's approvals travel down.
      if (l.id === 'owner_desk') { down('owner', 'state', '#fde047', i++); continue; }
      if (l.id === 'state') { down('state', 'shaheen', '#d8b4fe', i++); down('state', 'agent', '#d8b4fe', i++); continue; }
      // A robot's report travels up to its department and to Shaheen; the council's goes on to the State.
      const n = nodeOf(`bot:${l.id}`);
      if (!n?.parent) continue;
      up(n.id, n.parent, color, i++);
      up(n.parent, 'shaheen', color, i++);
      if (l.id === 'council' || l.id === 'precheck') up('shaheen', 'state', '#86efac', i++);
    }
    if (schoolOn) {
      HIERARCHY.filter((n) => n.kind === 'expert').forEach((n, k) => {
        down('school', n.id, '#93c5fd', k); // the question goes to the expert
        up(n.id, 'school', '#fcd34d', k + 3); // the reviewed lesson comes back
      });
      up('school', 'agent', '#fcd34d', 1); // and enters Shaheen's memory, where the agent answers from
    }
    return { out, lit };
  }, [live, schoolOn]);

  // The activity log: robots that started / finished, and lessons that entered the school.
  const feed = useMemo(() => {
    const runs = activityFeed(gh.runs, 10).map((f) => {
      const who = f.bots.length ? f.bots.map(botName).slice(0, 2).join(ar() ? '، ' : ', ') : f.workflow;
      const verb = f.kind === 'running' ? T('بدأت شغل') : f.kind === 'queued' ? T('دخلت الطابور') : f.kind === 'success' ? T('خلّصت شغلها بنجاح') : f.kind === 'cancelled' ? T('اتلغى تشغيلها') : T('فشلت');
      const emoji = f.kind === 'running' ? '🟢' : f.kind === 'queued' ? '🔵' : f.kind === 'success' ? '✅' : f.kind === 'cancelled' ? '⏹️' : '🔴';
      return { key: `r${f.id}${f.kind}`, at: f.at, text: `${emoji} ${who} — ${verb}`, url: f.url };
    });
    const lessons = (school?.lastStudied || []).slice(0, 6).map((s) => ({ key: `s${s.at}${s.q}`, at: s.at, text: `🎓 ${TP('درس جديد دخل المدرسة بعد المراجعة: {q}', { q: s.q.slice(0, 70) })}`, url: undefined as string | undefined }));
    return [...runs, ...lessons].filter((x) => Date.parse(x.at) > 0).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [gh.runs, school]);

  const pending = school ? Math.max(0, school.reliance.total - school.reliance.covered) : 0;
  const lessons = (sciences?.learned || 0) + (school?.studiedTotal || 0) + (school?.selfTaughtTotal || 0);
  const nowPlaying = running.slice(0, 4).map((l) => { const st = stepOf(l)?.step; return { id: l.id, text: st ? (ar() ? stepAr(st) || st : st) : T('شغالة — بتجهّز الخطوة الجاية') }; });

  const counters: { label: string; value: number; tone: string }[] = [
    { label: T('شغالة دلوقتي'), value: running.length, tone: 'text-emerald-300' },
    { label: T('في الطابور'), value: queued.length, tone: 'text-sky-300' },
    { label: T('واقفة'), value: stopped.length, tone: 'text-red-300' },
    { label: T('دروس في ذاكرة شاهين'), value: lessons, tone: 'text-amber-200' },
    { label: T('أسئلة مستنية المذاكرة'), value: pending, tone: 'text-indigo-200' },
  ];

  return (
    <div ref={box} className={`ocr mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-[#070b14] text-slate-100 shadow-xl ${full ? 'flex h-screen flex-col p-4' : 'p-3'}`} dir={ar() ? 'rtl' : 'ltr'}>
      <style>{`
        @keyframes ocr-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes ocr-glow { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        .ocr .ocr-in { animation: ocr-in .6s ease-out both; }
        .ocr .ocr-glow { animation: ocr-glow 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ocr .ocr-in, .ocr .ocr-glow { animation: none; } }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-base font-black text-amber-100">
          <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 ${still ? '' : 'animate-ping'} opacity-75`} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          {T('غرفة التحكم الحية')}
        </h4>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Radio className="h-5 w-5" />
          {gh.limitedUntil ? TP('GitHub طلب استراحة — هيكمل {time}', { time: clock(new Date(gh.limitedUntil).toISOString()) }) : gh.at ? TP('آخر تحديث {time}', { time: clock(new Date(gh.at).toISOString()) }) : T('بيجيب الحالة…')}
          <button type="button" onClick={toggleFull} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 font-bold text-slate-200 hover:bg-slate-800">
            {full ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}{full ? T('خروج من ملء الشاشة') : T('ملء الشاشة')}
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-400">{T('صاحب الموقع فوق الكل ← دولة المنصة ← شاهين المدير العام ووكيله ← الأقسام ومدرسة شاهين ← الروبوتات والخبراء السبعتاشر. النقط المتحركة = شغل ماشي دلوقتي: تقارير طالعة لفوق، وموافقات نازلة، وأسئلة رايحة للخبراء ودروس راجعة للمدرسة.')}</p>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
        {counters.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
            <b className={`block text-xl tabular-nums ${c.tone}`}><CountUp value={c.value} still={still} /></b>
            <span className="text-[13px] text-slate-400">{c.label}</span>
          </div>
        ))}
      </div>

      <div className={`mt-2 overflow-x-auto ${full ? 'min-h-0 flex-1' : ''}`}>
        <svg viewBox={`0 0 ${ROOM.width} ${ROOM.height}`} className={`block w-full min-w-[1150px] ${full ? 'h-full' : 'h-auto'}`} role="img" aria-label={T('غرفة التحكم الحية')} style={{ fontFamily: 'inherit', direction: 'ltr' }}>
          <defs>
            <radialGradient id="ocr-bg" cx="50%" cy="20%" r="85%"><stop offset="0%" stopColor="#13203a" /><stop offset="100%" stopColor="#070b14" /></radialGradient>
            <pattern id="ocr-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e293b" strokeWidth="0.6" /></pattern>
            <filter id="ocr-shine" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width={ROOM.width} height={ROOM.height} fill="url(#ocr-bg)" />
          <rect width={ROOM.width} height={ROOM.height} fill="url(#ocr-grid)" opacity={0.55} />
          {/* The two branches */}
          <text x={300} y={258} textAnchor="middle" fontSize={12.5} fill="#64748b" stroke="#070b14" strokeWidth={3} paintOrder="stroke">{T('فرع المعرفة: المدرسة وخبراؤها')}</text>
          <text x={930} y={258} textAnchor="middle" fontSize={12.5} fill="#64748b" stroke="#070b14" strokeWidth={3} paintOrder="stroke">{T('فرع التشغيل: الأقسام وروبوتاتها')}</text>

          {/* Reporting lines */}
          {EDGES.map((e) => {
            const on = flows.lit.has(`${e.from}>${e.to}`);
            const toBot = e.to.startsWith('bot:'); const toExpert = e.to.startsWith('expert:');
            // Many thin lines fan out to the robots and the experts: kept faint, the moving dots carry the work.
            const opacity = on ? (toBot || toExpert ? 0.45 : 0.9) : toBot || toExpert ? 0.5 : 1;
            return <path key={`${e.from}>${e.to}`} d={edgePathRoom(e.from, e.to)} fill="none" stroke={on ? '#38bdf8' : '#1e293b'} strokeOpacity={opacity} strokeWidth={on ? (toBot || toExpert ? 1 : 1.8) : toBot || toExpert ? 0.8 : 1.2} />;
          })}
          {/* Work moving along them */}
          {!still && flows.out.map((f) => <Particle key={f.key} d={f.d} color={f.color} dur={f.dur} delay={f.delay} />)}

          {/* Head nodes */}
          {HIERARCHY.filter((n) => BOX[n.kind]).map((n) => {
            const b = BOX[n.kind]; const on = nodeOn(n) || (n.kind === 'school' && schoolOn);
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                <title>{label(n)}</title>
                {on && <rect x={-b.w / 2 - 4} y={-b.h / 2 - 4} width={b.w + 8} height={b.h + 8} rx={12} fill="none" stroke={b.stroke} strokeWidth={2} filter="url(#ocr-shine)" className={still ? '' : 'ocr-glow'} />}
                <rect x={-b.w / 2} y={-b.h / 2} width={b.w} height={b.h} rx={10} fill={b.fill} stroke={b.stroke} strokeWidth={on ? 2 : 1.2} />
                <text y={4} textAnchor="middle" fontSize={b.size} fontWeight={800} fill={b.text}>{label(n).length > (n.kind === 'dept' ? 18 : 28) ? `${label(n).slice(0, n.kind === 'dept' ? 17 : 27)}…` : label(n)}</text>
              </g>
            );
          })}

          {/* Robots */}
          {HIERARCHY.filter((n) => n.kind === 'bot').map((n) => {
            const id = n.bots[0]; const l = stateOf.get(id); const st = l?.state || 'unknown'; const color = COLOR[st];
            const on = st === 'running' || st === 'queued';
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`} className="cursor-pointer" onClick={() => onPick(id)}>
                <title>{`${label(n)} — ${ar() ? l?.noteAr || '' : st}`}</title>
                {on && !still && (
                  <circle r={7} fill="none" stroke={color} strokeWidth={2}>
                    <animate attributeName="r" values="7;15" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={on ? 8 : 6.5} fill={color} stroke="#0b1220" strokeWidth={1.5} filter={on ? 'url(#ocr-shine)' : undefined} />
              </g>
            );
          })}

          {/* The seventeen experts */}
          {HIERARCHY.filter((n) => n.kind === 'expert').map((n, k) => {
            const p = progressOf(n.field); const fresh = freshFields.has(n.field || '');
            const R = 17; const C = 2 * Math.PI * R; const [l1, l2] = twoLines(label(n));
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                <title>{`${label(n)} — ${Math.round(p * 100)}%`}</title>
                {(schoolOn || fresh) && <circle r={R + 6} fill={fresh ? '#f59e0b' : '#6366f1'} opacity={0.25} className={still ? '' : 'ocr-glow'} style={{ animationDelay: `${(k % 6) * 0.25}s` }} />}
                <circle r={R} fill="#111827" stroke="#334155" strokeWidth={3} />
                <circle r={R} fill="none" stroke={fresh ? '#fbbf24' : '#818cf8'} strokeWidth={3} strokeDasharray={`${C * p} ${C}`} transform="rotate(-90)" strokeLinecap="round" />
                <text y={4.5} textAnchor="middle" fontSize={11.5} fontWeight={800} fill="#e0e7ff">{Math.round(p * 100)}</text>
                <text y={R + 14} textAnchor="middle" fontSize={11.5} fill="#cbd5e1" stroke="#070b14" strokeWidth={3} paintOrder="stroke">{l1}</text>
                {l2 && <text y={R + 28} textAnchor="middle" fontSize={11.5} fill="#cbd5e1" stroke="#070b14" strokeWidth={3} paintOrder="stroke">{l2}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <div className="mb-1 text-sm font-black text-emerald-300">{T('بيحصل دلوقتي')}</div>
          {nowPlaying.length ? (
            <ul className="space-y-1 text-sm">
              {nowPlaying.map((x) => (
                <li key={x.id} className="ocr-in flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full bg-emerald-400 ${still ? '' : 'animate-pulse'}`} /><button type="button" className="font-bold text-slate-100 hover:underline" onClick={() => onPick(x.id)}>{botName(x.id)}</button><span className="truncate text-slate-400">{x.text}</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">{T('مفيش روبوت شغال في اللحظة دي — كله مستني دوره.')}</p>}
          {schoolOn && <p className="ocr-in mt-1 text-sm text-indigo-200">🎓 {T('المدرسة شغالة: الأسئلة رايحة للخبراء والدروس المراجَعة راجعة لذاكرة شاهين.')}</p>}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
          <div className="mb-1 text-sm font-black text-amber-200">{T('سجل النشاط')}</div>
          <ul className="space-y-1 text-sm">
            {feed.map((f) => (
              <li key={f.key} className="ocr-in flex items-start gap-2">
                <span className="shrink-0 tabular-nums text-slate-500">{clock(f.at)}</span>
                {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="text-slate-200 hover:underline">{f.text}</a> : <span className="text-slate-200">{f.text}</span>}
              </li>
            ))}
            {!feed.length && <li className="text-slate-500">{T('لسه مفيش نشاط متسجل.')}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
