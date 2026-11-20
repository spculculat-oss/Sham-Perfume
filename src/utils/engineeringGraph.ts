import { compileEngineeringSampler, radiansPerUnit, type EvaluateOptions } from './engineeringCalculator';
import { differentiateNumerically, integrateNumerically } from './engineeringNumeric';

export type GraphKind = 'cartesian' | 'polar' | 'parametric';
export interface GraphPoint { t: number; x: number; y: number }
export interface GraphBounds { left: number; right: number; bottom: number; top: number }
export interface GraphCurve { label: string; points: (GraphPoint | null)[]; at: (t: number) => GraphPoint | null }
export interface EngineeringGraph { kind: GraphKind; start: number; end: number; curves: GraphCurve[]; bounds: GraphBounds }
export const GRAPH_SAMPLES = 257;
const make = (length: number) => Array.from({ length }, (_, i) => i);
const valid = (n: number | null): n is number => n !== null && Number.isFinite(n);
const domain = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || Math.max(Math.abs(a), Math.abs(b)) > 1e9 || b - a < 1e-8) throw new Error('Enter an increasing finite range.');
};
const span = (a: number, b: number) => {
  const padding = Math.max((b - a) * 0.08, (a === b ? Math.max(1, Math.abs(a) * 0.08) : 1e-9));
  return [a - padding, b + padding] as const;
};
function extent(data: number[]): readonly [number, number] {
  const sorted = [...data].sort((a, b) => a - b);
  // One point next to a pole should not compress the entire continuous part of a graph.
  const trim = Math.floor(sorted.length * 0.015);
  return span(sorted[trim], sorted[sorted.length - 1 - trim]);
}

export function buildEngineeringGraph(kind: GraphKind, input: readonly { first: string; second?: string; label: string }[], start: number, end: number, options: EvaluateOptions = {}): EngineeringGraph {
  domain(start, end);
  const entries = input.filter((i) => i.first.trim() || i.second?.trim());
  if (!entries.length || entries.length > 3) throw new Error('Enter one to three curves.');
  const alias = (value: string) => kind === 'cartesian' ? value : value.replace(/(?<![a-z_])(?:t|theta)(?![a-z_0-9])|θ/gi, 'x');
  const angle = radiansPerUnit(options.angleMode ?? 'DEG');
  const curves = entries.map(({ first, second, label }) => {
    const a = compileEngineeringSampler(alias(first), options);
    const b = kind === 'parametric' ? compileEngineeringSampler(alias(second ?? ''), options) : undefined;
    const at = (t: number): GraphPoint | null => {
      const v = a(t);
      if (!valid(v) || Math.abs(v) > 1e15) return null;
      if (kind === 'cartesian') return { t, x: t, y: v };
      if (kind === 'polar') return { t, x: v * Math.cos(t * angle), y: v * Math.sin(t * angle) };
      const y = b!(t);
      return valid(y) && Math.abs(y) <= 1e15 ? { t, x: v, y } : null;
    };
    return { label, at, points: make(GRAPH_SAMPLES).map((i) => at(start + (end - start) * i / (GRAPH_SAMPLES - 1))) };
  });
  const points = curves.flatMap(({ points }) => points.filter((p): p is GraphPoint => Boolean(p)));
  if (!points.length) throw new Error('No real values in this plotting range.');
  const [bottom, top] = extent(points.map((p) => p.y));
  const [left, right] = kind === 'cartesian' ? [start, end] : extent(points.map((p) => p.x));
  return { kind, start, end, curves, bounds: { left, right, bottom, top } };
}

type Numeric = (x: number) => number | null;
function bisect(fn: Numeric, lo: number, hi: number, fa: number, fb: number): number | undefined {
  let bestX = Math.abs(fa) <= Math.abs(fb) ? lo : hi;
  let best = Math.min(Math.abs(fa), Math.abs(fb));
  const scale = Math.max(Math.abs(fa), Math.abs(fb));
  const required = Math.min(scale * 1e-9, best * 1e-5);
  for (let i = 0; i < 55; i++) {
    const mid = lo + (hi - lo) / 2;
    if (mid === lo || mid === hi) break;
    const y = fn(mid);
    if (!valid(y)) return undefined; // discontinuity, not a root
    if (!y) return mid;
    if (Math.abs(y) < best) { best = Math.abs(y); bestX = mid; }
    if (Math.sign(y) === Math.sign(fa)) lo = mid;
    else hi = mid;
  }
  return best <= required ? bestX : undefined;
}

function turn(fn: Numeric, lo: number, hi: number, sign: 1 | -1): number | undefined {
  // Refine a sampled extremum within its small bracket; invalid points are not filled.
  for (let i = 0; i < 88; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    const u = fn(a), v = fn(b);
    if (!valid(u) || !valid(v)) return undefined;
    if (a === lo || b === hi) break;
    if (sign * u < sign * v) hi = b;
    else if (sign * v < sign * u) lo = a;
    else { lo = a; hi = b; }
  }
  const closest = [lo, lo + (hi - lo) / 2, hi].map((x) => ({ x, y: fn(x) })).filter(({ y }) => valid(y));
  return closest.sort((a, b) => sign * (a.y! - b.y!))[0]?.x;
}

interface RootScan { roots: number[]; turns: { x: number; min: boolean }[]; coincident: boolean }
function scan(fn: Numeric, start: number, end: number): RootScan {
  const xs = make(GRAPH_SAMPLES).map((i) => start + (end - start) * i / (GRAPH_SAMPLES - 1));
  const ys = xs.map(fn);
  const defined = ys.filter(valid);
  const roots: number[] = [];
  const turns: RootScan['turns'] = [];
  const coincident = defined.length === xs.length && defined.every((y) => y === 0);
  const add = (x: number) => {
    if (roots.length < 24 && roots.every((root) => Math.abs(root - x) > (end - start) * 1e-7)) roots.push(x);
  };
  if (!coincident) xs.forEach((x, i) => {
    const y = ys[i], next = ys[i + 1], previous = ys[i - 1];
    if (!valid(y)) return;
    if (y === 0 && previous !== 0 && next !== 0) add(x);
    if (valid(next) && y && next && Math.sign(y) !== Math.sign(next)) {
      const root = bisect(fn, x, xs[i + 1], y, next);
      if (root !== undefined) add(root);
    }
    if (!valid(previous) || !valid(next) || turns.length >= 24) return;
    const min = y <= previous && y <= next && (y < previous || y < next);
    if (min || (y >= previous && y >= next && (y > previous || y > next))) {
      const found = turn(fn, xs[i - 1], xs[i + 1], min ? 1 : -1);
      if (found === undefined) return;
      const value = fn(found);
      // Discard runaway maxima at a pole (including same-sign poles).
      const scale = Math.max(Math.abs(previous), Math.abs(next), Math.abs(y), 1e-15);
      if (!valid(value) || Math.abs(value) > scale * 50) return;
      if (turns.every((p) => Math.abs(p.x - found) > (end - start) * 1e-7)) turns.push({ x: found, min });
      // A tiny nonzero minimum is not proof of a tangency to the x-axis.
      if (value === 0 && Math.sign(previous) === Math.sign(next)) add(found);
    }
  });
  return { roots: roots.sort((a, b) => a - b), turns, coincident };
}

export function analyzeEngineeringGraph(graph: EngineeringGraph, index: number) {
  if (graph.kind !== 'cartesian' || !graph.curves[index]) throw new Error('Select a Cartesian curve.');
  const yAt: Numeric = (x) => graph.curves[index].at(x)?.y ?? null;
  const primary = scan(yAt, graph.start, graph.end);
  const intersections = graph.curves.flatMap((curve, i) => {
    if (i === index) return [];
    const diff = scan((x) => {
      const a = yAt(x), b = curve.at(x)?.y;
      return a === null || b === undefined ? null : a - b;
    }, graph.start, graph.end);
    return [{ label: curve.label, coincident: diff.coincident, points: diff.roots.map((x) => ({ x, y: yAt(x)! })) }];
  });
  const samples = graph.curves[index].points.filter((p): p is GraphPoint => Boolean(p));
  return { roots: primary.roots, allZero: primary.coincident,
    extrema: primary.turns.map(({ x, min }) => ({ x, y: yAt(x)!, min })), intersections,
    sampledRange: samples.length ? [Math.min(...samples.map((p) => p.y)), Math.max(...samples.map((p) => p.y))] : undefined };
}

/** Signed numerical integral, rejected when the embedded estimates do not agree. */
export function graphIntegral(at: GraphCurve['at'], from: number, to: number): number | undefined {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return;
  return integrateNumerically((x) => at(x)?.y, from, to, 4096);
}

export function graphSlope(at: GraphCurve['at'], point: number): number | undefined {
  return differentiateNumerically((x) => at(x)?.y, point);
}

export type SurfacePoint = readonly [x: number, y: number, z: number];
export type SurfaceKind = 'function' | 'plane' | 'sphere' | 'cylinder';
export function engineeringSurface(kind: SurfaceKind, expression: string, size: number, options: EvaluateOptions = {}): (SurfacePoint | null)[][] {
  if (!(size > 0 && size <= 1e6)) throw new Error('Use a positive radius or half width.');
  const sample = kind === 'function' || kind === 'plane' ? compileEngineeringSampler(kind === 'plane' ? 'x/2+y/3' : expression, options) : undefined;
  const resolution = 24;
  const mesh = make(resolution + 1).map((u) => make(resolution + 1).map((v): SurfacePoint | null => {
    const a = 2 * u / resolution - 1;
    const b = 2 * v / resolution - 1;
    if (sample) {
      const x = size * a, y = size * b, z = sample(x, y);
      return valid(z) && Math.abs(z) <= 1e12 ? [x, y, z] : null;
    }
    const az = b * Math.PI;
    const el = kind === 'sphere' ? a * Math.PI / 2 : 0;
    return [size * Math.cos(el) * Math.cos(az), size * Math.cos(el) * Math.sin(az), size * (kind === 'sphere' ? Math.sin(el) : a)];
  }));
  if (mesh.every((row) => row.every((point) => !point))) throw new Error('No real surface values in this range.');
  return mesh;
}

export function engineeringSequence(expression: string, kind: 'explicit' | 'first' | 'second', length: number, first: number, second: number, options: EvaluateOptions = {}): number[] {
  if (!Number.isInteger(length) || length < 1 || length > 100 || !Number.isFinite(first) || !Number.isFinite(second)) throw new Error('Use between 1 and 100 terms and finite starting values.');
  const at = compileEngineeringSampler(expression.replace(/(?<![a-z_])n(?![a-z_0-9])/gi, 'x'), options);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const value = (kind !== 'explicit' && i === 0) ? first : kind === 'second' && i === 1 ? second : at(i + 1, out[i - 1] ?? 0, out[i - 2] ?? 0);
    if (!valid(value)) throw new Error('The formula became undefined in the requested sequence.');
    out.push(value);
  }
  return out;
}
