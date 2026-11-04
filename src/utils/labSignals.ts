/**
 * «إشارات المعمل» — the anonymous, opt-in tally that «روبوت سلوك الزائر العطري» studies
 * (bot `scent_behavior`, `scripts/shaheen-scent/`, report `src/data/live/scent-behavior.json`).
 *
 * What a visitor's design sends — and ONLY when he presses the share button himself:
 *   - the ids of the materials in his formula (never a typed free text, never a title),
 *   - the perfume type and a coarse concentration band (edc / edt / edp / extrait / oil).
 *
 * What it never carries: names, emails, device ids, IP addresses, titles, notes, prices, timestamps of a
 * person. The server adds one to a counter and forgets the request. The design journal stays on the
 * visitor's own device (`src/utils/designers/journal.ts`) — sharing is a deliberate, separate act.
 *
 * Pure and browser-safe: the client sender (`labSignalSend.ts`), the server recorder (`server/labSignals.ts`)
 * and the robot all share these helpers, so the stored shape can never drift.
 */

export type LabConcentrationBand = 'edc' | 'edt' | 'edp' | 'extrait' | 'oil';

export const LAB_BANDS: LabConcentrationBand[] = ['edc', 'edt', 'edp', 'extrait', 'oil'];

/** What one press of the share button sends. */
export interface LabSignalPayload {
  type: string;
  band: LabConcentrationBand;
  /** Material ids only (the lab bank's ids); typed labels never leave the device. */
  materials: string[];
}

/** The aggregate the server keeps and the robot reads. Counters only. */
export interface LabAggregate {
  version: 1;
  updatedAt?: string;
  /** One press = one design. */
  designs: number;
  /** material id → how many designs used it. */
  materials: Record<string, number>;
  /** material name a visitor typed but the lab bank does not know → how many designs typed it. */
  typed: Record<string, number>;
  /** perfume type → designs. */
  types: Record<string, number>;
  /** concentration band → designs. */
  bands: Record<string, number>;
}

export const EMPTY_LAB_AGGREGATE: LabAggregate = { version: 1, designs: 0, materials: {}, typed: {}, types: {}, bands: {} };

const MAX_KEYS = 600;
const MAX_COUNT = 1_000_000_000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The coarse band of a design (the exact percentage is deliberately not recorded). */
export function bandOf(type: string, concentration: number): LabConcentrationBand {
  if (type === 'oil' || type === 'mist') return 'oil';
  const c = Number(concentration);
  if (!Number.isFinite(c) || c <= 0) return 'edp';
  if (c <= 6) return 'edc';
  if (c <= 15) return 'edt';
  if (c <= 22) return 'edp';
  return 'extrait';
}

export interface DesignLike {
  type: string;
  concentration: number;
  lines: { materialId?: string; label: string; pct: number }[];
}

/** A clean payload from a design, or null when there is nothing honest to send (no known material). */
export function labSignalFromDesign(design: DesignLike): LabSignalPayload | null {
  const materials = [...new Set(design.lines
    .filter((l) => Number(l.pct) > 0 && typeof l.materialId === 'string' && ID.test(l.materialId))
    .map((l) => l.materialId as string))].slice(0, 24);
  if (!materials.length) return null;
  return { type: String(design.type || 'edp').slice(0, 16), band: bandOf(design.type, design.concentration), materials };
}

/** Reads any stored/returned aggregate honestly: unknown shapes become an empty aggregate, never a guess. */
export function readLabAggregate(raw: unknown): LabAggregate {
  const o = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  const data = o(raw);
  const counters = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(o(v))) {
      const n = Number(value);
      if (ID.test(key) && Number.isFinite(n) && n > 0) out[key] = Math.min(Math.floor(n), MAX_COUNT);
    }
    return out;
  };
  const designs = Number(data.designs);
  return {
    version: 1,
    ...(typeof data.updatedAt === 'string' ? { updatedAt: data.updatedAt } : {}),
    designs: Number.isFinite(designs) && designs > 0 ? Math.min(Math.floor(designs), MAX_COUNT) : 0,
    materials: counters(data.materials),
    typed: counters(data.typed),
    types: counters(data.types),
    bands: counters(data.bands),
  };
}

/** The payload the recorder accepts (a strict reading of what the browser may send). */
export function readLabSignalPayload(raw: unknown): LabSignalPayload | null {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (!Array.isArray(data.materials) || !data.materials.length || data.materials.length > 24) return null;
  const materials = [...new Set(data.materials.filter((m): m is string => typeof m === 'string' && ID.test(m)))];
  if (!materials.length || !data.materials.every((m) => typeof m === 'string' && ID.test(m))) return null;
  const band = typeof data.band === 'string' && (LAB_BANDS as string[]).includes(data.band) ? (data.band as LabConcentrationBand) : null;
  if (!band) return null;
  const type = typeof data.type === 'string' && ID.test(data.type) ? data.type : 'edp';
  return { type, band, materials };
}

/** One press added to the aggregate (counters capped so a flood can never grow the record without limit). */
export function addLabSignal(aggregate: LabAggregate, payload: LabSignalPayload, now: Date = new Date()): LabAggregate {
  const bump = (source: Record<string, number>, key: string) => {
    if (!ID.test(key)) return source;
    if (!(key in source) && Object.keys(source).length >= MAX_KEYS) return source;
    return { ...source, [key]: Math.min((source[key] || 0) + 1, MAX_COUNT) };
  };
  let next: LabAggregate = { ...aggregate, version: 1, updatedAt: now.toISOString(), designs: Math.min(aggregate.designs + 1, MAX_COUNT) };
  next = { ...next, types: bump(next.types, payload.type), bands: bump(next.bands, payload.band) };
  for (const id of payload.materials) next = { ...next, materials: bump(next.materials, id) };
  return next;
}

/** Human note shown next to the share button: no name, no title, no contact — counters only. */
export const LAB_SIGNAL_NOTE = {
  ar: 'مجهول تماماً: بيتبعت أسماء الخامات ونوع التركيز بس — من غير اسمك ولا عنوان تركيبتك ولا أي بيانات شخصية.',
  en: 'Fully anonymous: only the material names and the concentration type are sent — never your name, your formula title or any personal data.',
};
