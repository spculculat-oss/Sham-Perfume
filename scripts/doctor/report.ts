/**
 * The maintenance log of «طبيب شاهين» is one GitHub issue (label `shaheen-doctor`): its body is the live
 * status board, and it also carries the agent's memory between runs in a hidden comment. Comments on the
 * issue are written only when something happens (a remedy, a fix, a revert, a new problem, a recovery).
 */
import { emptyState, overall, type DoctorState } from './playbook';
import type { CheckId, Finding } from './probes';

export const ISSUE_LABEL = 'shaheen-doctor';
export const ISSUE_TITLE = '🩺 طبيب شاهين — سجل الصيانة التلقائية';
const STATE_RE = /<!-- doctor-state:([A-Za-z0-9+/=_-]+) -->/;

export const CHECK_LABEL: Record<CheckId, string> = {
  api: 'الـ API (Vercel)', deploy: 'النشر', modes: 'أوضاع شاهين', chat: 'سؤال تجريبي لشاهين', cors: 'ربط GitHub Pages بالـ API',
  pages: 'موقع GitHub Pages', runtime: 'عدّادات الخادم', ci: 'فحص وبناء main', media: 'الصور',
};
const ICON = { ok: '🟢', warn: '🟡', fail: '🔴', skip: '⚪' } as const;
const HEADLINE = { ok: '🟢 كله سليم', warn: '🟡 فيه تحذيرات', fail: '🔴 فيه مشكلة' } as const;

export function readState(body: string | null | undefined): DoctorState {
  const match = body?.match(STATE_RE);
  if (!match) return emptyState();
  try {
    const state = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as DoctorState;
    return state?.version === 1 ? { ...emptyState(), ...state } : emptyState();
  } catch { return emptyState(); }
}

export const cairo = (iso: string) => new Date(iso).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'short', timeStyle: 'short' });
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

export interface ActionLog { at: string; kind: string; reason: string; ok: boolean; detail: string }

export function renderBody(findings: Finding[], state: DoctorState, extra: { notes: string[]; actions: ActionLog[]; site: string; runUrl?: string; mode: string }): string {
  const status = overall(findings);
  const recent = state.history.slice(-36);
  const timeline = recent.map((h) => (h.fails.length ? '🔴' : h.warns.length ? '🟡' : '🟢')).join('');
  const fixes = state.fixes.slice(-10).reverse();
  const RESULT = { merged: '⏳ اتدمج، بيتراقب', failed: '❌ ما عدّاش الفحوص — ما اتطبقش', verified: '✅ اتأكد إنه شغال', reverted: '↩️ اترجع تلقائيًا', unverified: '⚪ ما اتنشرش للتأكيد' };
  return [
    `## ${HEADLINE[status]}`,
    '',
    `آخر فحص: **${cairo(state.lastRunAt || new Date().toISOString())}** (بتوقيت القاهرة) · فحص رقم ${state.runs} · كل 10 دقايق${extra.mode === 'dry' ? ' · **وضع المراجعة فقط**' : ''}${extra.runUrl ? ` · [تفاصيل التشغيل](${extra.runUrl})` : ''}`,
    `الموقع: ${extra.site}`,
    '',
    '| الفحص | الحالة | التفاصيل |',
    '|---|---|---|',
    ...findings.map((f) => `| ${CHECK_LABEL[f.id]} | ${ICON[f.status]} | ${cell(f.summary)} |`),
    '',
    `**آخر 6 ساعات:** ${timeline || '—'}`,
    '',
    ...(extra.actions.length ? ['### إجراءات الفحص ده', ...extra.actions.map((a) => `- ${a.ok ? '✅' : '⚠️'} **${a.kind}** — ${a.reason}: ${a.detail}`), ''] : []),
    ...(extra.notes.length ? ['### ملاحظات', ...extra.notes.map((n) => `- ${n}`), ''] : []),
    '### الإصلاحات التلقائية في الكود',
    ...(fixes.length ? fixes.map((f) => `- ${cairo(f.at)} — ${f.summary || f.problem} — ${RESULT[f.result]}${f.url ? ` ([التغيير](${f.url}))` : ''}`) : ['- لسه مفيش']),
    '',
    '<sub>الطبيب بيصلّح لوحده: بيعيد تشغيل النشر والفحوص، وبيصفّي ذاكرة الخادم، وبيكتب إصلاحات للكود لما الفحوص كلها تعدّي، وبيرجّع أي إصلاح يعمل مشاكل. أي تعليق هنا مش بيأثر عليه.</sub>',
    `<!-- doctor-state:${Buffer.from(JSON.stringify(state)).toString('base64')} -->`,
  ].join('\n');
}

/** Comment-worthy events: actions taken, a problem confirmed (2 runs), or full recovery. */
export function eventComment(findings: Finding[], previous: DoctorState['history'][number] | undefined, state: DoctorState, actions: ActionLog[], notes: string[]): string | undefined {
  const lines: string[] = [];
  const confirmed = findings.filter((f) => f.status === 'fail' && state.streaks[f.id] === 2);
  if (confirmed.length) lines.push(`🔴 **مشكلة مؤكدة:** ${confirmed.map((f) => `${CHECK_LABEL[f.id]} — ${f.summary}`).join(' · ')}`);
  if (previous?.fails.length && overall(findings) !== 'fail') lines.push(`🟢 **رجع سليم:** ${previous.fails.map((id) => CHECK_LABEL[id]).join('، ')}`);
  for (const a of actions) lines.push(`${a.ok ? '🛠️' : '⚠️'} **${a.kind}** — ${a.reason}\n  ${a.detail}`);
  for (const n of notes.filter((n) => n.startsWith('✅'))) lines.push(n);
  return lines.length ? lines.join('\n\n') : undefined;
}
