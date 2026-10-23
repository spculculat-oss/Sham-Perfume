/**
 * «دفتر المصمم»: every formula the designer saves, with its versions (each simulation kept as a snapshot: verdict,
 * staying power or texture) and the designer's own evaluation after smelling or trying it. Stored on the designer's
 * device only (localStorage) — nothing is sent anywhere; export gives a JSON file the designer keeps.
 */
export type DesignerKind = 'perfume' | 'cosmetic';

export interface JournalVersion<D> {
  at: string;
  design: D;
  /** A one-line snapshot of the simulation at save time (verdict and the key numbers). */
  summary: { verdict: 'pass' | 'warn' | 'fail'; score?: number; note?: string };
  /** The designer's own evaluation 1–5 after trying it, with a note. */
  rating?: number;
  notes?: string;
}

export interface JournalEntry<D> { id: string; title: string; created: string; updated: string; versions: JournalVersion<D>[] }

const key = (kind: DesignerKind) => `sham_designer_journal_v1_${kind}`;
const MAX_ENTRIES = 60;
const MAX_VERSIONS = 20;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };

export function readJournal<D>(kind: DesignerKind, store: Store | undefined = storage()): JournalEntry<D>[] {
  try {
    const raw = store?.getItem(key(kind));
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as JournalEntry<D>[]).filter((e) => e && typeof e.id === 'string' && Array.isArray(e.versions) && e.versions.length > 0) : [];
  } catch { return []; }
}

function write<D>(kind: DesignerKind, entries: JournalEntry<D>[], store: Store | undefined): boolean {
  try { store?.setItem(key(kind), JSON.stringify(entries.slice(0, MAX_ENTRIES))); return Boolean(store); } catch { return false; }
}

const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Save a version: into the entry `id` when given (a new version), else a new entry. Returns the entry id. */
export function saveVersion<D>(kind: DesignerKind, input: { id?: string; title: string; design: D; summary: JournalVersion<D>['summary'] }, store: Store | undefined = storage(), now = new Date()): string {
  const entries = readJournal<D>(kind, store);
  const at = now.toISOString();
  const version: JournalVersion<D> = { at, design: input.design, summary: input.summary };
  const found = input.id ? entries.find((e) => e.id === input.id) : undefined;
  if (found) {
    found.title = input.title || found.title;
    found.updated = at;
    found.versions = [version, ...found.versions].slice(0, MAX_VERSIONS);
    write(kind, [found, ...entries.filter((e) => e !== found)], store);
    return found.id;
  }
  const entry: JournalEntry<D> = { id: newId(), title: input.title || '—', created: at, updated: at, versions: [version] };
  write(kind, [entry, ...entries], store);
  return entry.id;
}

/** The designer's evaluation of a version (index 0 = latest). */
export function rateVersion<D>(kind: DesignerKind, id: string, index: number, rating: number, notes: string, store: Store | undefined = storage()): void {
  const entries = readJournal<D>(kind, store);
  const e = entries.find((x) => x.id === id);
  const v = e?.versions[index];
  if (!v) return;
  v.rating = Math.max(1, Math.min(5, Math.round(rating)));
  v.notes = notes.slice(0, 600);
  write(kind, entries, store);
}

export function deleteEntry(kind: DesignerKind, id: string, store: Store | undefined = storage()): void {
  write(kind, readJournal(kind, store).filter((e) => e.id !== id), store);
}

/** What changed between two versions of a formula: added, removed and changed lines (by label). */
export function compareLines(a: { label: string; pct: number }[], b: { label: string; pct: number }[]): { label: string; from?: number; to?: number }[] {
  const A = new Map(a.map((l) => [l.label, l.pct]));
  const B = new Map(b.map((l) => [l.label, l.pct]));
  const out: { label: string; from?: number; to?: number }[] = [];
  for (const label of new Set([...A.keys(), ...B.keys()])) {
    const from = A.get(label), to = B.get(label);
    if (from === undefined || to === undefined || Math.abs(from - to) >= 0.01) out.push({ label, from, to });
  }
  return out;
}

export const journalExport = <D>(kind: DesignerKind, entries: JournalEntry<D>[]) => JSON.stringify({ kind, exported: new Date().toISOString(), entries }, null, 2);

/** Import a file made by journalExport (merged by id; the newer copy wins). Returns how many entries came in. */
export function journalImport<D>(kind: DesignerKind, text: string, store: Store | undefined = storage()): number {
  try {
    const data = JSON.parse(text) as { kind?: string; entries?: JournalEntry<D>[] };
    if (data.kind !== kind || !Array.isArray(data.entries)) return 0;
    const incoming = data.entries.filter((e) => e && typeof e.id === 'string' && Array.isArray(e.versions) && e.versions.length > 0);
    const mine = readJournal<D>(kind, store);
    const byId = new Map(mine.map((e) => [e.id, e]));
    for (const e of incoming) { const old = byId.get(e.id); if (!old || old.updated < e.updated) byId.set(e.id, e); }
    write(kind, [...byId.values()].sort((x, y) => (x.updated < y.updated ? 1 : -1)), store);
    return incoming.length;
  } catch { return 0; }
}
