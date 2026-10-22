/**
 * «الهيكل والتراتبية» (the owner's request, 2026-10-22): who sits over whom on the platform, from the owner down to
 * every robot — drawn by «غرفة التحكم الحية» (src/admin/OpsControlRoom.tsx) at the top of the operations map.
 *
 *   صاحب الموقع  (orders above everyone, any time)
 *     └ دولة المنصة  (every approval; decides and acts by its own laws)
 *         ├ الخبير شاهين — المدير العام  (runs the departments)
 *         │    └ الأقسام الخمسة → روبوتات كل قسم
 *         └ وكيل شاهين  (answers visitors: understands, picks the expert, compares the sources)
 *              └ مدرسة شاهين وأكاديميتها → الخبراء السبعتاشر
 *
 * Pure and browser-safe. Every robot of src/utils/shaheenOrg.ts sits under exactly one department; every expert
 * of «وكيل شاهين» (src/utils/shaheenAgent.ts) under the school. Positions are SVG user units (left-to-right; the
 * Arabic reading order puts the operations branch on the right).
 */
import { BOTS, DEPARTMENTS, type BotId, type DeptId } from './shaheenOrg';
import { SCHOOL_EXPERTS, type FieldId } from './shaheenAgent';

export type TierId = 'owner' | 'state' | 'lead' | 'branch' | 'unit';
export type HNodeKind = 'owner' | 'state' | 'shaheen' | 'agent' | 'school' | 'expert' | 'dept' | 'bot';
export interface HNode {
  id: string;
  kind: HNodeKind;
  tier: TierId;
  labelAr: string;
  labelEn: string;
  parent?: string;
  /** The robots whose work lights this node up on the live screen. */
  bots: BotId[];
  field?: FieldId;
  dept?: DeptId;
  x: number;
  y: number;
}

export const ROOM = { width: 1280, height: 640 } as const;
export const TIERS: { id: TierId; y: number; labelAr: string; labelEn: string }[] = [
  { id: 'owner', y: 46, labelAr: 'صاحب الموقع', labelEn: 'Owner' },
  { id: 'state', y: 124, labelAr: 'دولة المنصة', labelEn: 'The State' },
  { id: 'lead', y: 206, labelAr: 'القيادة', labelEn: 'Leadership' },
  { id: 'branch', y: 292, labelAr: 'الأقسام والمدرسة', labelEn: 'Departments & school' },
  { id: 'unit', y: 372, labelAr: 'الروبوتات والخبراء', labelEn: 'Robots & experts' },
];
const Y = Object.fromEntries(TIERS.map((t) => [t.id, t.y])) as Record<TierId, number>;

/** Department order on the operations branch, right to left (leadership first, as Arabic reads). */
export const BRANCH_DEPTS: DeptId[] = ['leadership', 'store', 'content', 'experience', 'reliability'];
const DEPT_X0 = 1195; const DEPT_STEP = 132;
export const deptRoomX = (d: DeptId) => DEPT_X0 - BRANCH_DEPTS.indexOf(d) * DEPT_STEP;
/** Robots under a department: two columns of dots. */
export const BOT_DOT = { gapX: 30, gapY: 30 } as const;
/** Experts under the school: rows of six on the knowledge branch (left). */
export const EXPERT_GRID = { x0: 70, gapX: 92, gapY: 78, perRow: 6 } as const;
export const SCHOOL_BOTS: BotId[] = ['academy', 'school', 'teacher'];
/** Robots that are the top seats themselves (the owner's desk, the State's robot): drawn as those seats, not under a department. */
export const SEAT_BOTS: BotId[] = ['owner_desk', 'state'];
const SCHOOL_X = 300; const SHAHEEN_X = 900; const AGENT_X = 360;

const shortExpert = (s: string) => s.replace(/^خبير(ة)?\s+/, '');

export function hierarchy(): HNode[] {
  const nodes: HNode[] = [
    { id: 'owner', kind: 'owner', tier: 'owner', labelAr: 'صاحب الموقع', labelEn: 'Site owner', bots: ['owner_desk'], x: ROOM.width / 2, y: Y.owner },
    { id: 'state', kind: 'state', tier: 'state', labelAr: 'دولة المنصة', labelEn: 'The Platform State', parent: 'owner', bots: ['state'], x: ROOM.width / 2, y: Y.state },
    { id: 'shaheen', kind: 'shaheen', tier: 'lead', labelAr: 'الخبير شاهين — المدير العام', labelEn: 'Master Shaheen — manager', parent: 'state', bots: ['council', 'secretary', 'precheck', 'patrol'], x: SHAHEEN_X, y: Y.lead },
    { id: 'agent', kind: 'agent', tier: 'lead', labelAr: 'وكيل شاهين', labelEn: 'Shaheen agent', parent: 'state', bots: ['chat', 'library', 'researcher'], x: AGENT_X, y: Y.lead },
    { id: 'school', kind: 'school', tier: 'branch', labelAr: 'مدرسة شاهين وأكاديميتها', labelEn: "Shaheen's school & academy", parent: 'agent', bots: SCHOOL_BOTS, x: SCHOOL_X, y: Y.branch },
  ];
  SCHOOL_EXPERTS.forEach((e, i) => {
    const row = Math.floor(i / EXPERT_GRID.perRow); const col = i % EXPERT_GRID.perRow;
    // Rows right to left too, so the first experts sit nearest the school's centre line.
    nodes.push({
      id: `expert:${e.field}`, kind: 'expert', tier: 'unit', labelAr: shortExpert(e.nameAr), labelEn: e.nameEn.replace(/\s+expert$/i, ''), parent: 'school',
      bots: SCHOOL_BOTS, field: e.field, x: EXPERT_GRID.x0 + (EXPERT_GRID.perRow - 1 - col) * EXPERT_GRID.gapX, y: Y.unit + row * EXPERT_GRID.gapY,
    });
  });
  for (const d of DEPARTMENTS) {
    const x = deptRoomX(d.id);
    const members = BOTS.filter((b) => b.dept === d.id && !SEAT_BOTS.includes(b.id));
    nodes.push({ id: `dept:${d.id}`, kind: 'dept', tier: 'branch', labelAr: d.nameAr.replace(/^قسم\s+/, ''), labelEn: d.nameEn, parent: 'shaheen', bots: members.map((b) => b.id), dept: d.id, x, y: Y.branch });
    members.forEach((b, i) => {
      const col = i % 2; const row = Math.floor(i / 2);
      nodes.push({ id: `bot:${b.id}`, kind: 'bot', tier: 'unit', labelAr: b.nameAr, labelEn: b.nameEn, parent: `dept:${d.id}`, bots: [b.id], dept: d.id,
        x: x + (col ? -BOT_DOT.gapX / 2 : BOT_DOT.gapX / 2), y: Y.unit + row * BOT_DOT.gapY });
    });
  }
  return nodes;
}

export const HIERARCHY = hierarchy();
export const nodeOf = (id: string) => HIERARCHY.find((n) => n.id === id);
/** Who this node reports to, up to the owner (itself first). */
export function chainOf(id: string): HNode[] {
  const out: HNode[] = [];
  for (let n = nodeOf(id); n && out.length < 10; n = n.parent ? nodeOf(n.parent) : undefined) out.push(n);
  return out;
}
/** The reporting lines: child → parent. */
export const EDGES = HIERARCHY.filter((n) => n.parent).map((n) => ({ from: n.parent!, to: n.id }));

/** A smooth line from a parent's bottom to its child's top (the path the live particles travel along). */
export function edgePathRoom(fromId: string, toId: string): string {
  const a = nodeOf(fromId); const b = nodeOf(toId);
  if (!a || !b) return '';
  // Siblings on one row (a robot's dot under the one above it) go straight; others curve down.
  const y1 = a.y + (a.kind === 'bot' ? 6 : 16); const y2 = b.y - (b.kind === 'bot' ? 6 : 16);
  const mid = (y1 + y2) / 2;
  return `M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`;
}
