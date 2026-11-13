/**
 * Admin operations agent — a Manus-style task runner for Sham's management team.
 *
 *   request in natural language → plan (task list) → run each read-only admin tool
 *   → observations → report sections + prioritised next actions → optional model summary
 *
 * Tools only READ business data. The agent never changes orders, stock or settings;
 * it tells the team what needs attention and links to the right dashboard tab.
 */
import type { Repository } from './repository';
import { callEngine, engineStatuses } from './engines';
import { normalize } from './text';
import { INTENT_LABEL } from './orchestrator';

const REQUEST_TYPE: Record<string, string> = { order: 'طلبات متجر', custom_formula: 'عطور مخصصة', b2b_quote: 'عروض جملة', consultation: 'استشارات', support: 'دعم', service: 'خدمات أخرى' };
import type { EngineId } from './types';
import { withHandbook } from '../../src/utils/botHandbook';

export type AdminTask = 'pending_requests' | 'handoffs' | 'low_stock' | 'knowledge_gaps' | 'satisfaction' | 'sales' | 'intents';
export interface AgentSection { task: AdminTask; title: string; severity: 'ok' | 'warn' | 'alert'; lines: string[]; tab: string; metrics: Record<string, number> }
export interface AgentStep { task: AdminTask; title: string; status: 'done' | 'failed'; ms: number }
export interface AgentResult { plan: AgentStep[]; sections: AgentSection[]; nextActions: { text: string; tab: string }[]; summary: string; engine: EngineId }

const TITLES: Record<AdminTask, string> = {
  pending_requests: 'الطلبات المعلقة', handoffs: 'محادثات بانتظار موظف', low_stock: 'المخزون',
  knowledge_gaps: 'فجوات المعرفة', satisfaction: 'رضا الزوار', sales: 'المبيعات والطلبات (7 أيام)', intents: 'اهتمامات الزوار (7 أيام)',
};
const ALL: AdminTask[] = ['pending_requests', 'handoffs', 'low_stock', 'knowledge_gaps', 'satisfaction', 'sales', 'intents'];
const KEYWORDS: Record<AdminTask, string[]> = {
  pending_requests: ['طلب', 'اوردر', 'عروض', 'order', 'request'],
  handoffs: ['تحويل', 'موظف', 'محادث', 'ينتظر', 'منتظر', 'handoff', 'waiting', 'conversation'],
  low_stock: ['مخزون', 'ستوك', 'نفد', 'نفاد', 'stock', 'inventory'],
  knowledge_gaps: ['فجوات', 'فجوه', 'اسئله', 'معرفه', 'gap', 'question', 'knowledge'],
  satisfaction: ['رضا', 'تقييم', 'سلبي', 'feedback', 'rating', 'satisfaction'],
  sales: ['مبيعات', 'ايراد', 'قيمه', 'مقارن', 'sales', 'revenue'],
  intents: ['نوايا', 'اهتمام', 'بيسالوا', 'يسالون', 'intent', 'topic'],
};

export function planAdminTasks(message: string): AdminTask[] {
  const text = ` ${normalize(message)}`;
  // Word-start match, tolerant of the Arabic article/conjunction prefixes (ال، وال، بال، و).
  const picked = ALL.filter((task) => KEYWORDS[task].some((k) => ['', 'ال', 'وال', 'بال', 'و'].some((p) => text.includes(` ${p}${normalize(k)}`))));
  return picked.length ? picked : ALL; // "تقرير اليوم" or anything vague → full daily report
}

const DAY = 24 * 3600_000;
const hoursAgo = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 3600_000);

export async function runAdminAgent(repo: Repository, message: string, options: { env?: Record<string, string | undefined>; fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<AgentResult> {
  const tasks = planAdminTasks(message);
  const [requests, conversations, products, gaps] = await Promise.all([repo.requests(), repo.conversations(), repo.products(true), repo.gaps()]);
  const now = Date.now();
  const tools: Record<AdminTask, () => Omit<AgentSection, 'task' | 'title'>> = {
    pending_requests: () => {
      const fresh = requests.filter((r) => r.status === 'new');
      const stale = fresh.filter((r) => now - Date.parse(r.createdAt) > DAY);
      const progress = requests.filter((r) => r.status === 'in_progress' || r.status === 'quoted');
      return {
        severity: stale.length ? 'alert' : fresh.length ? 'warn' : 'ok', tab: 'requests',
        metrics: { new: fresh.length, stale: stale.length, inProgress: progress.length },
        lines: [
          `${fresh.length} طلب جديد، منها ${stale.length} عمره أكثر من 24 ساعة.`,
          ...stale.slice(0, 5).map((r) => `• ${r.ref} — ${r.contact.name} — منذ ${hoursAgo(r.createdAt)} ساعة`),
          `${progress.length} طلب قيد التنفيذ أو بانتظار رد العميل على عرض السعر.`,
        ],
      };
    },
    handoffs: () => {
      const open = conversations.filter((c) => c.status === 'handoff');
      const waiting = open.filter((c) => c.messages.at(-1)?.role === 'user' || !c.messages.some((m) => m.engine === 'human'));
      return {
        severity: waiting.length ? 'alert' : 'ok', tab: 'conversations',
        metrics: { open: open.length, waiting: waiting.length },
        lines: [
          `${open.length} محادثة محوّلة لموظف، ${waiting.length} منها لم يرد عليها موظف بعد.`,
          ...waiting.slice(0, 5).map((c) => `• ${c.memory.name || c.visitorId.slice(0, 10)} — آخر نشاط منذ ${hoursAgo(c.updatedAt)} ساعة`),
        ],
      };
    },
    low_stock: () => {
      const active = products.filter((p) => p.active);
      const out = active.filter((p) => p.stock === 0);
      const low = active.filter((p) => p.stock > 0 && p.stock <= 3);
      return {
        severity: out.length ? 'alert' : low.length ? 'warn' : 'ok', tab: 'products',
        metrics: { active: active.length, out: out.length, low: low.length },
        lines: active.length ? [
          `${active.length} منتج ظاهر: ${out.length} نفد و${low.length} مخزونه 3 أو أقل.`,
          ...[...out, ...low].slice(0, 6).map((p) => `• ${p.nameAr || p.nameEn} (${p.sku}) — المتبقي ${p.stock}`),
        ] : ['الكتالوج فارغ؛ المساعد لن يعرض أسعاراً حتى تُضاف منتجات.'],
      };
    },
    knowledge_gaps: () => {
      const open = gaps.filter((g) => g.status === 'open').sort((a, b) => b.count - a.count);
      return {
        severity: open.length >= 5 ? 'warn' : 'ok', tab: 'quality',
        metrics: { open: open.length },
        lines: open.length ? [
          `${open.length} سؤال/رد يحتاج إجابة في قاعدة المعرفة. الأكثر تكراراً:`,
          ...open.slice(0, 5).map((g) => `• «${g.question.slice(0, 80)}» ×${g.count}${g.source === 'negative_feedback' ? ' (تقييم سلبي)' : ''}`),
        ] : ['لا توجد فجوات مفتوحة.'],
      };
    },
    satisfaction: () => {
      const rated = conversations.flatMap((c) => c.messages).filter((m) => m.feedback && now - Date.parse(m.feedback.at) <= 7 * DAY);
      const up = rated.filter((m) => m.feedback!.rating === 'up').length;
      const down = rated.length - up;
      const rate = rated.length ? Math.round((up / rated.length) * 100) : 0;
      return {
        severity: rated.length >= 5 && rate < 70 ? 'alert' : down ? 'warn' : 'ok', tab: 'quality',
        metrics: { up, down, rate },
        lines: rated.length ? [`${rated.length} تقييم: 👍 ${up} / 👎 ${down} — نسبة الرضا ${rate}%.`] : ['لا توجد تقييمات خلال آخر 7 أيام.'],
      };
    },
    sales: () => {
      const window = (from: number, to: number) => requests.filter((r) => { const t = now - Date.parse(r.createdAt); return t >= from && t < to; });
      const current = window(0, 7 * DAY);
      const previous = window(7 * DAY, 14 * DAY);
      const value = (list: typeof requests) => {
        const out: Record<string, number> = {};
        for (const r of list) if (r.total !== undefined && r.currency && r.status !== 'cancelled') out[r.currency] = Math.round(((out[r.currency] || 0) + r.total) * 100) / 100;
        return out;
      };
      const v = value(current);
      const byType: Record<string, number> = {};
      for (const r of current) byType[r.type] = (byType[r.type] || 0) + 1;
      const delta = current.length - previous.length;
      return {
        severity: 'ok', tab: 'requests',
        metrics: { current: current.length, previous: previous.length },
        lines: [
          `${current.length} طلب هذا الأسبوع مقابل ${previous.length} الأسبوع السابق (${delta >= 0 ? '+' : ''}${delta}).`,
          Object.keys(byType).length ? `حسب النوع: ${Object.entries(byType).map(([k, n]) => `${REQUEST_TYPE[k] || k}: ${n}`).join('، ')}` : 'لا توجد طلبات هذا الأسبوع.',
          Object.keys(v).length ? `قيمة طلبات المتجر غير الملغاة: ${Object.entries(v).map(([c, n]) => `${n} ${c}`).join('، ')}` : '',
        ].filter(Boolean),
      };
    },
    intents: () => {
      const counts: Record<string, number> = {};
      let messages = 0;
      for (const c of conversations) for (const m of c.messages) {
        if (m.role === 'user' && now - Date.parse(m.at) <= 7 * DAY) { messages++; if (m.intent) counts[m.intent] = (counts[m.intent] || 0) + 1; }
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return {
        severity: 'ok', tab: 'overview', metrics: { messages },
        lines: top.length ? [`${messages} رسالة من الزوار. الأكثر طلباً:`, ...top.map(([k, n]) => `• ${(INTENT_LABEL.ar as Record<string, string>)[k] || k}: ${n}`)] : ['لا توجد رسائل خلال آخر 7 أيام.'],
      };
    },
  };

  const plan: AgentStep[] = [];
  const sections: AgentSection[] = [];
  for (const task of tasks) {
    const start = Date.now();
    try {
      sections.push({ task, title: TITLES[task], ...tools[task]() });
      plan.push({ task, title: TITLES[task], status: 'done', ms: Date.now() - start });
    } catch {
      plan.push({ task, title: TITLES[task], status: 'failed', ms: Date.now() - start });
    }
  }

  const nextActions: AgentResult['nextActions'] = [];
  const m = (task: AdminTask) => sections.find((s) => s.task === task)?.metrics;
  if (m('handoffs')?.waiting) nextActions.push({ text: `رد على ${m('handoffs')!.waiting} محادثة تنتظر موظفاً`, tab: 'conversations' });
  if (m('pending_requests')?.stale) nextActions.push({ text: `راجع ${m('pending_requests')!.stale} طلباً متأخراً أكثر من 24 ساعة`, tab: 'requests' });
  else if (m('pending_requests')?.new) nextActions.push({ text: `راجع ${m('pending_requests')!.new} طلباً جديداً`, tab: 'requests' });
  if (m('low_stock')?.out) nextActions.push({ text: `أعد تخزين ${m('low_stock')!.out} منتجاً نفد`, tab: 'products' });
  if (m('knowledge_gaps')?.open) nextActions.push({ text: `أضف إجابات لأكثر الأسئلة تكراراً (${m('knowledge_gaps')!.open})`, tab: 'quality' });
  if ((m('satisfaction')?.down || 0) > 0) nextActions.push({ text: 'راجع الردود التي قيّمها الزوار سلبياً', tab: 'quality' });

  const alerts = sections.filter((s) => s.severity !== 'ok');
  const local = alerts.length
    ? `يحتاج انتباهك: ${alerts.map((s) => `${s.title} (${s.lines[0]})`).join(' • ')}`
    : 'كل المؤشرات المطلوبة مستقرة؛ لا توجد عناصر عاجلة.';

  // Optional model summary over the SAME numbers (no new facts allowed), following the admin engine policy.
  let summary = local;
  let engine: EngineId = 'sham_local';
  const env = options.env || process.env;
  const settings = await repo.settings();
  const statuses = engineStatuses(env);
  for (const id of settings.enginePolicy) {
    if (id === 'sham_local') break;
    if (!statuses.find((s) => s.id === id)?.configured) continue;
    try {
      const text = await callEngine(id, withHandbook('admin_agent', 'أنت مساعد عمليات لفريق إدارة متجر عطور. اكتب ملخصاً تنفيذياً بالعربية في 3 جمل كحد أقصى، مرتباً حسب الأولوية. استخدم الأرقام الموجودة في البيانات فقط ولا تضف أي رقم أو حقيقة غير موجودة.'), [
        { role: 'user', text: `طلب المدير: ${message}\nالبيانات:\n${JSON.stringify(sections.map(({ title, severity, lines }) => ({ title, severity, lines })))}` },
      ], { env, fetch: options.fetch, temperature: 0.2, signal: AbortSignal.any([AbortSignal.timeout(12000), ...(options.signal ? [options.signal] : [])]) });
      if (text) { summary = text; engine = id; break; }
    } catch { /* fall through to the next engine / local summary */ }
  }
  return { plan, sections, nextActions, summary, engine };
}
