/**
 * «شاهين الوكيل المسؤول — تحت إشراف صاحب الموقع» (the owner's decision, 2026-10-22): Shaheen prepares everything the
 * site needs — changes, orders to the robots, the council's tasks — and NOTHING is carried out until the owner has
 * reviewed it and pressed «وافق». Every approval is a request the owner opens on GitHub from his own account (GitHub
 * proves it is him); «مكتب صاحب الموقع» (owner-control.yml → scripts/owner/apply-change.mts) carries it out, checks
 * everything, and answers on the same request. Every request stays listed as the log, and anything carried out can
 * be undone with «رجّع».
 *
 * Kinds of request:
 *   change — a code change Shaheen proposed in the private room (src/utils/ownerFiles.ts);
 *   order  — an order Shaheen prepared for the robots: pause / resume one, stop / restart all, run one now;
 *   decide — the owner's answer on something waiting for him: a robot's pull request or a council task
 *            (approve / reject / return to Shaheen with a note);
 *   revert — undo what an earlier request carried out.
 */
import { BOTS, type BotId } from './shaheenOrg';
import { maskSensitive, OWNER, OWNER_APPROVAL_LABEL, type SelfDevVerdict } from './ownerAuthority';
import { CHANGE_TITLE_PREFIX, SITE_REPO, decodePayload, readChange, type ChangePlan, type ChangeRequest } from './ownerFiles';

export const TASK_APPROVAL_LABEL = 'needs-approval';
export const TASK_APPROVED_LABEL = 'approved-by-owner';

// ── Orders Shaheen may prepare for the robots (never the owner's own switches for approvals) ───────────────
export type DeskOrderAction = 'pause' | 'resume' | 'freeze' | 'unfreeze' | 'run';
export const DESK_ORDERS: Record<DeskOrderAction, string> = {
  pause: 'وقف روبوت', resume: 'رجّع روبوت للشغل', freeze: 'وقف كل الروبوتات (فرامل الطوارئ)', unfreeze: 'رجّع كل الروبوتات', run: 'شغّل روبوت دلوقتي',
};
/** Robots an order can name: every robot with its own workflow, except the site build and the owner's desk itself. */
export const orderableBots = () => BOTS.filter((b) => b.workflow && b.workflow !== 'pages.yml' && b.workflow !== 'owner-control.yml');
export const botName = (id: string) => BOTS.find((b) => b.id === id)?.nameAr ?? id;

export interface DeskOrder { action: DeskOrderAction; bot?: BotId }
const ORDER_MARK = /\[\[\s*(?:أمر|امر|order)\s*:\s*([a-z_]+)(?:\s+([a-z_]+))?\s*\]\]/giu;

/** The orders in a reply: «[[أمر: pause doctor]]», «[[أمر: freeze]]», «[[أمر: run patrol]]». Unknown ones are dropped. */
export function parseOrders(reply: string): DeskOrder[] {
  const out: DeskOrder[] = [];
  for (const m of reply.matchAll(ORDER_MARK)) {
    const order = readOrder({ action: m[1], bot: m[2] });
    if (order && !out.some((o) => o.action === order.action && o.bot === order.bot)) out.push(order);
  }
  return out.slice(0, 3);
}
export function readOrder(x: unknown): DeskOrder | undefined {
  const o = x as { action?: unknown; bot?: unknown };
  if (!o || typeof o.action !== 'string' || !(o.action in DESK_ORDERS)) return undefined;
  const action = o.action as DeskOrderAction;
  if (action === 'freeze' || action === 'unfreeze') return { action };
  const bot = orderableBots().find((b) => b.id === o.bot)?.id;
  return bot ? { action, bot } : undefined;
}
/** The reply as the owner reads it: each order mark becomes a pointer to its card. */
export const displayOrders = (text: string) => text.replace(ORDER_MARK, (m, action: string, bot?: string) => {
  const o = readOrder({ action, bot });
  return o ? `> 🧭 أمر: ${orderText(o)} — مستني موافقتك في الكارت تحت.` : m;
});
export const orderText = (o: DeskOrder) => `${DESK_ORDERS[o.action]}${o.bot ? `: ${botName(o.bot)}` : ''}`;
export const workflowOf = (bot: BotId) => BOTS.find((b) => b.id === bot)?.workflow;

// ── The requests ───────────────────────────────────────────────────────────────────────────────────────────
export type Decision = 'approve' | 'reject' | 'return';
export const DECISIONS: Record<Decision, string> = { approve: 'وافق', reject: 'رفض', return: 'رجّعه لشاهين بملاحظة' };

export type DeskRequest =
  | { v: 2; kind: 'change'; summary: string; edits: ChangeRequest['edits'] }
  | { v: 2; kind: 'order'; summary: string; order: DeskOrder }
  | { v: 2; kind: 'decide'; summary: string; target: number; decision: Decision; note?: string }
  | { v: 2; kind: 'revert'; summary: string; request: number };

/** Reads any request the desk may receive (the first room changes were version 1). */
export function readDesk(x: unknown): DeskRequest | undefined {
  const change = readChange(x);
  if (change) return { v: 2, kind: 'change', summary: change.summary, edits: change.edits };
  const r = x as Record<string, unknown>;
  if (!r || r.v !== 2 || typeof r.summary !== 'string') return undefined;
  const summary = r.summary.slice(0, 300);
  if (r.kind === 'order') { const order = readOrder(r.order); return order ? { v: 2, kind: 'order', summary, order } : undefined; }
  const n = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 && (v as number) < 1e7 ? (v as number) : undefined);
  if (r.kind === 'decide') {
    const target = n(r.target);
    if (!target || typeof r.decision !== 'string' || !(r.decision in DECISIONS)) return undefined;
    const note = typeof r.note === 'string' && r.note.trim() ? maskSensitive(r.note.trim()).slice(0, 1000) : undefined;
    if (r.decision === 'return' && !note) return undefined;
    return { v: 2, kind: 'decide', summary, target, decision: r.decision as Decision, ...(note ? { note } : {}) };
  }
  if (r.kind === 'revert') { const request = n(r.request); return request ? { v: 2, kind: 'revert', summary, request } : undefined; }
  return undefined;
}
export async function decodeDesk(encoded: string): Promise<DeskRequest | undefined> { return readDesk(await decodePayload(encoded)); }

const FENCE = 'shaheen-change';
/** The request the owner opens on GitHub: a title, a few plain lines, and the request itself. Never the room's words. */
export function deskIssue(title: string, lines: string[], encoded: string): { title: string; body: string } {
  const clean = maskSensitive(title.replace(/\s+/g, ' ').trim()).slice(0, 90) || 'طلب من صاحب الموقع';
  return {
    title: `${CHANGE_TITLE_PREFIX}${clean}`,
    body: [...lines.map((l) => maskSensitive(l)), '', 'مكتب صاحب الموقع هينفذ الطلب ده ويرد هنا. لو حاجة فشلت، مفيش حاجة هتتغير.', '', `\`\`\`${FENCE}`, encoded, '```'].join('\n'),
  };
}

/** What one answer of the owner sends: the request's title, its plain lines, and the request itself. */
export interface DeskDraft { title: string; lines: string[]; payload: DeskRequest }

export function changeDraft(summary: string, plan: ChangePlan, verdict: SelfDevVerdict, edits: ChangeRequest['edits']): DeskDraft {
  return {
    title: summary || 'تعديل من غرفة شاهين',
    lines: ['🦅 **تعديل اقترحه شاهين في غرفة صاحب الموقع، وصاحب الموقع وافق عليه.**', '',
      `**الملفات:** ${plan.files.map((f) => `\`${f.path}\``).join('، ')} (${plan.lines} سطر)`, `**الحكم:** ${verdict.auto ? '✅' : '🔑'} ${verdict.reasonAr}`],
    payload: { v: 2, kind: 'change', summary, edits },
  };
}

export function orderDraft(order: DeskOrder, summary: string): DeskDraft {
  const text = orderText(order);
  return {
    title: text,
    lines: [`🦅 **أمر جهّزه شاهين، وصاحب الموقع وافق عليه:** ${text}`, ...(summary ? [`**السبب:** ${summary}`] : [])],
    payload: { v: 2, kind: 'order', summary: summary || text, order },
  };
}

const VERB: Record<Decision, string> = { approve: 'موافقة على', reject: 'رفض', return: 'ملاحظة على' };
const MARK: Record<Decision, string> = { approve: '✅', reject: '❌', return: '↩️' };
export function decideDraft(item: Pick<InboxItem, 'number' | 'kind' | 'title'>, decision: Decision, note = ''): DeskDraft {
  const n = note.trim();
  return {
    title: `${VERB[decision]} #${item.number}: ${item.title}`,
    lines: [`${MARK[decision]} **صاحب الموقع: ${VERB[decision]} #${item.number}**`, `${item.kind === 'pull' ? 'تعديل من روبوت' : 'مهمة من المجلس'}: ${item.title}`],
    payload: { v: 2, kind: 'decide', summary: item.title, target: item.number, decision, ...(n ? { note: n } : {}) },
  };
}

export function revertDraft(item: Pick<LogItem, 'number' | 'title'>): DeskDraft {
  return {
    title: `رجوع عن الطلب #${item.number}`,
    lines: [`↩️ **صاحب الموقع طالب يرجّع اللي غيّره الطلب #${item.number}** (${item.title}).`],
    payload: { v: 2, kind: 'revert', summary: item.title, request: item.number },
  };
}

/** The issue-number trailer every commit from the desk carries, so «رجّع» can find exactly what a request changed. */
export const requestTrailer = (n: number) => `Owner-Request: #${n}`;

// ── «صندوق الموافقات»: what waits for the owner, from the public repository (no key) ────────────────────────
export interface GhIssue {
  number: number; title: string; body?: string | null; html_url: string; state: string; state_reason?: string | null;
  labels?: ({ name?: string } | string)[]; pull_request?: unknown; created_at: string; closed_at?: string | null; user?: { login?: string };
}
export type InboxKind = 'pull' | 'task';
export interface InboxItem { number: number; kind: InboxKind; title: string; summary: string; url: string; at: string }

const labelNames = (i: GhIssue) => (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name || ''));
/** Plain words from an issue body: no markdown, no hidden notes, no long lists — the first few lines only. */
export function plainSummary(body: string | null | undefined, max = 320): string {
  const text = (body || '').replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '').split('\n')
    .map((l) => l.replace(/^[#>\-*\s]+/, '').replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim())
    .filter((l) => l && !/^-{3,}$/.test(l)).join(' · ');
  return maskSensitive(text.length > max ? `${text.slice(0, max - 1)}…` : text);
}

/** What waits for the owner: robots' pull requests marked for his approval and council tasks that need it. */
export function inboxFrom(issues: GhIssue[]): InboxItem[] {
  const items: InboxItem[] = [];
  for (const i of issues) {
    if (i.state !== 'open') continue;
    const labels = labelNames(i);
    const kind: InboxKind | undefined = i.pull_request && labels.includes(OWNER_APPROVAL_LABEL) ? 'pull'
      : !i.pull_request && labels.includes(TASK_APPROVAL_LABEL) && labels.includes('shaheen-task') ? 'task' : undefined;
    if (!kind || items.some((x) => x.number === i.number)) continue;
    items.push({ number: i.number, kind, title: i.title.replace(/^مهمة شاهين:\s*/, ''), summary: plainSummary(i.body), url: i.html_url, at: i.created_at });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export type LogState = 'waiting' | 'done' | 'refused';
/** `undoable`: a request that may have changed files (a rejection or a note changes nothing, so it has no «رجّع»). */
export interface LogItem { number: number; title: string; url: string; state: LogState; at: string; undoable: boolean }
/** The owner's requests to the desk, newest first: the log of everything he approved, refused or undid. */
export function deskLog(issues: GhIssue[], owner: string): LogItem[] {
  return issues
    .filter((i) => !i.pull_request && i.title.startsWith(CHANGE_TITLE_PREFIX) && (!i.user?.login || i.user.login.toLowerCase() === owner.toLowerCase()))
    .map((i) => {
      const title = i.title.slice(CHANGE_TITLE_PREFIX.length);
      return { number: i.number, title, url: i.html_url, at: i.closed_at || i.created_at, undoable: !/^(رفض|ملاحظة على) #\d+/.test(title),
        state: (i.state === 'open' ? 'waiting' : i.state_reason === 'not_planned' ? 'refused' : 'done') as LogState };
    })
    .sort((a, b) => b.number - a.number);
}

const API = `https://api.github.com/repos/${SITE_REPO}`;
export const inboxUrls = () => [
  `${API}/issues?labels=${encodeURIComponent(OWNER_APPROVAL_LABEL)}&state=open&per_page=30`,
  `${API}/issues?labels=${encodeURIComponent(`shaheen-task,${TASK_APPROVAL_LABEL}`)}&state=open&per_page=30`,
];
export const logUrl = () => `${API}/issues?state=all&creator=${encodeURIComponent(OWNER.github)}&per_page=40&sort=created&direction=desc`;
