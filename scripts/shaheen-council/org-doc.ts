/**
 * The organisation chart of the platform, generated from src/utils/shaheenOrg.ts:
 *   - orgDoc(): SHAHEEN_ORG.md (Mermaid map + tables; GitHub renders it),
 *   - orgSvg(): a self-contained picture of the map (RTL), optionally coloured by the pre-meeting check.
 * scripts/shaheen-council/org-doc.mts writes them; tests/shaheenOrg.test.ts keeps the .md up to date.
 */
import { BOTS, DEPARTMENTS, LEGAL_DECISIONS, LINKS, SECRETARY, botOf, botsIn, orgMermaid, type BotId } from '../../src/utils/shaheenOrg';
import type { BotStatus } from './precheck';

const every = (h?: number) => (!h ? 'عند الطلب / مع كل تعديل' : h < 24 ? `كل ${h} ساعات` : h === 24 ? 'يومياً' : h === 168 ? 'أسبوعياً' : `كل ${h} ساعة`);

export function orgDoc(): string {
  const out: string[] = [
    '# الهيكل الإداري لمنصة شام — تحت مظلة الخبير شاهين',
    '',
    '> ملف مولَّد تلقائياً من `src/utils/shaheenOrg.ts` — لا تعدله يدوياً. للتحديث: `node --import tsx scripts/shaheen-council/org-doc.mts`.',
    '',
    'كل روبوت وكل أداة ذكاء اصطناعي في المنصة لها مكان في الهيكل: **الخبير شاهين** المدير العام، **السكرتير** (مشرف شاهين) نائبه وقت الضغط، وخمس خلايا (أقسام) كل واحدة يرأسها كرسي في الاجتماع اليومي.',
    '',
    '- **قبل الاجتماع بساعتين** (4:30 بتوقيت جرينتش = 7:30 الصبح بتوقيت القاهرة الصيفي) كل أداة تعمل فحص شامل لنفسها: المشاكل، الإصلاح المقترح، وأفكار التطوير (`shaheen-precheck.yml`).',
    '- **الاجتماع اليومي** (6:30 بتوقيت جرينتش = 9:30 الصبح بتوقيت القاهرة) يناقش نتيجة الفحص كجدول أعمال (`shaheen-council.yml`).',
    '- **أي روبوت جديد** لازم يتسجل هنا، وإلا الاختبارات تفشل (`tests/shaheenOrg.test.ts`).',
    '',
    '## الخريطة',
    '',
    '```mermaid',
    orgMermaid(),
    '```',
    '',
    '## السكرتير — مشرف شاهين',
    '',
    ...SECRETARY.dutiesAr.map((d) => `- ${d}`),
    '',
  ];
  for (const d of DEPARTMENTS) {
    out.push(`## ${d.nameAr}`, '', `**الرئيس:** ${d.headAr} — ${d.missionAr}`, '', '| الأداة | المهمة | المواعيد | الروبوت | التقرير |', '|---|---|---|---|---|');
    for (const b of botsIn(d.id)) out.push(`| ${b.nameAr} | ${b.dutiesAr} | ${every(b.everyHours)} | ${b.workflow ? `\`${b.workflow}\`` : '—'} | ${b.report ? `\`${b.report}\`` : '—'} |`);
    out.push('');
  }
  out.push('## قرارات المدير القانوني (ملزمة لشاهين وكل الأدوات)', '', ...LEGAL_DECISIONS.map((x) => `- **${x.id}** (${botOf(x.bot)!.nameAr}): ${x.textAr}`), '', 'الاجتماع اليومي مايقترحش تجاوز أي قرار منهم، والمدير القانوني بس هو اللي يرفعه.', '');
  out.push('## التعاون بين الأدوات', '', '| من | إلى | ليه |', '|---|---|---|');
  for (const l of LINKS) out.push(`| ${botOf(l.from)!.nameAr} | ${botOf(l.to)!.nameAr} | ${l.whyAr} |`);
  out.push('', 'طلبات المساعدة الفعلية (من تقارير الأدوات) بتظهر كل يوم في الفحص الشامل وفي لوحة الإدارة ← «إدارة الذكاء الاصطناعي» ← «الهيكل الإداري».', '');
  return out.join('\n');
}

// ── The picture ──────────────────────────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLORS: Record<string, string> = { leadership: '#b8860b', store: '#8b5a2b', content: '#2f6f8f', experience: '#7a4e9c', reliability: '#2e7d4f' };
const DOT: Record<BotStatus, string> = { ok: '#22a35a', warn: '#e0a800', fail: '#d43c3c', idle: '#a0a0a0' };

/** Splits Arabic text into lines of at most `max` characters (by words). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function orgSvg(status: Partial<Record<BotId, BotStatus>> = {}, opts: { font?: string; date?: string } = {}): string {
  const font = opts.font || 'Cairo, Noto Sans Arabic, Tahoma, Arial, sans-serif';
  const W = 1900;
  const parts: string[] = [];
  const box = (x: number, y: number, w: number, h: number, fill: string, stroke: string, r = 14, dash = '') =>
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  const text = (x: number, y: number, s: string, size: number, fill = '#222', weight = 400, anchor = 'middle') =>
    parts.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">\u202B${esc(s)}\u202C</text>`);
  const line = (x1: number, y1: number, x2: number, y2: number, color = '#b8a170', dash = '') =>
    parts.push(`<path d="M${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  const dot = (x: number, y: number, id: BotId) => { const s = status[id]; if (s) parts.push(`<circle cx="${x}" cy="${y}" r="8" fill="${DOT[s]}" stroke="#fff" stroke-width="2"/>`); };

  // Title (every line is a right-to-left embedding; right-aligned lines use text-anchor="end").
  text(W / 2, 62, 'الهيكل الإداري لمنصة شام — تحت قيادة الخبير شاهين', 40, '#5a3d0c', 700);
  text(W / 2, 100, `عدد الأدوات والروبوتات ${BOTS.length} في 5 خلايا · فحص شامل قبل الاجتماع بساعتين · سكرتير ينوب وقت الضغط${opts.date ? ` · ${opts.date}` : ''}`, 20, '#7a6a4f');

  // Leadership: Shaheen in the middle, the secretary, the pre-check and the council around him.
  const cx = W / 2;
  box(cx - 210, 130, 420, 96, '#fff8e6', COLORS.leadership!, 20);
  text(cx, 172, 'الخبير شاهين', 32, '#5a3d0c', 700);
  text(cx, 206, 'المدير العام — يرأس الاجتماع اليومي', 19, '#7a5a1c');
  const lead = [
    { id: 'secretary' as BotId, x: cx + 330, label: 'السكرتير — مشرف شاهين', sub: 'ينوب عن شاهين وقت الضغط' },
    { id: 'council' as BotId, x: cx - 330, label: 'مجلس شاهين', sub: 'الاجتماع اليومي 9:30 الصبح' },
    { id: 'precheck' as BotId, x: cx - 700, label: 'الفحص الشامل', sub: 'قبل الاجتماع بساعتين 7:30' },
  ];
  for (const l of lead) {
    box(l.x - 160, 146, 320, 72, '#fffdf6', COLORS.leadership!, 14, l.id === 'secretary' ? '' : '');
    text(l.x, 176, l.label, 21, '#5a3d0c', 700);
    text(l.x, 203, l.sub, 16, '#7a6a4f');
    dot(l.x + 148, 158, l.id);
  }
  parts.push(`<line x1="${cx + 210}" y1="178" x2="${cx + 170}" y2="182" stroke="${COLORS.leadership}" stroke-width="3"/>`);
  parts.push(`<line x1="${cx - 210}" y1="182" x2="${cx - 170}" y2="182" stroke="${COLORS.leadership}" stroke-width="3" stroke-dasharray="6 5"/>`);
  parts.push(`<line x1="${cx - 490}" y1="182" x2="${cx - 540}" y2="182" stroke="${COLORS.leadership}" stroke-width="3" stroke-dasharray="6 5"/>`);
  // Secretary duties panel (right).
  const duties = SECRETARY.dutiesAr;
  box(W - 395, 236, 365, 40 + duties.length * 72, '#fffaf0', '#e2cf9f', 12, '6 5');
  text(W - 212, 262, 'مهام السكرتير', 19, '#5a3d0c', 700);
  duties.forEach((d, i) => wrap(d, 42).slice(0, 3).forEach((ln, j) => text(W - 45, 292 + i * 72 + j * 20, ln, 14.5, '#5c4a2a', 400, 'end')));

  // Departments (right to left).
  const depts = DEPARTMENTS.filter((d) => d.id !== 'leadership');
  const colW = 330, gap = 26, top = 330;
  const totalW = depts.length * colW + (depts.length - 1) * gap;
  const left0 = (W - 400 - totalW) / 2 + 10;
  let bottom = top;
  depts.forEach((d, i) => {
    const x = left0 + totalW - (i + 1) * colW - i * gap;
    const mid = x + colW / 2;
    const color = COLORS[d.id]!;
    line(cx, 226, mid, top, color);
    box(x, top, colW, 78, color, color, 14);
    wrap(d.nameAr, 26).forEach((ln, j, all) => text(mid, top + (all.length > 1 ? 32 : 44) + j * 26, ln, 21, '#fff', 700));
    text(mid, top + 104, `الرئيس: ${d.headAr}`, 14.5, color, 700);
    let y = top + 122;
    for (const b of botsIn(d.id)) {
      const name = wrap(b.nameAr, 26);
      const duty = wrap(b.dutiesAr, 40).slice(0, 2);
      const h = 22 + name.length * 24 + duty.length * 19 + 12;
      box(x + 8, y, colW - 16, h, '#ffffff', color, 10);
      name.forEach((ln, j) => text(mid, y + 28 + j * 24, ln, 17.5, '#222', 700));
      duty.forEach((ln, j) => text(mid, y + 28 + name.length * 24 + 2 + j * 19, ln, 13, '#666'));
      dot(x + colW - 22, y + 14, b.id);
      y += h + 10;
    }
    bottom = Math.max(bottom, y);
  });

  // Cooperation between the tools.
  const ty = bottom + 30;
  const half = Math.ceil(LINKS.length / 2);
  const rows = half;
  box(30, ty, W - 60, 64 + rows * 30, '#fbfaf7', '#d8cfb8', 16);
  text(W / 2, ty + 40, 'التعاون والتنسيق بين الأدوات (مين بيساعد مين)', 24, '#5a3d0c', 700);
  LINKS.forEach((l, i) => {
    const col = i < half ? 0 : 1;
    const row = i % half;
    const xr = col === 0 ? W - 60 : W / 2 - 20;
    const yy = ty + 80 + row * 30;
    const c = COLORS[botOf(l.from)!.dept]!;
    parts.push(`<circle cx="${xr - 6}" cy="${yy - 6}" r="6" fill="${c}"/>`);
    text(xr - 22, yy, `من ${botOf(l.from)!.nameAr} إلى ${botOf(l.to)!.nameAr}:  ${l.whyAr}`, 15.5, '#333', 400, 'end');
  });
  const H = ty + 64 + rows * 30 + 70;
  // Legend
  const lg = [['ok', 'سليمة'], ['warn', 'محتاجة انتباه'], ['fail', 'فيها عطل'], ['idle', 'بدون بيانات']] as const;
  if (Object.keys(status).length) lg.forEach(([k, label], i) => {
    const x = W - 60 - i * 190;
    parts.push(`<circle cx="${x}" cy="${H - 36}" r="8" fill="${DOT[k]}"/>`);
    text(x - 16, H - 30, label, 16, '#555', 400, 'end');
  });
  text(150, H - 30, 'شام للعطور — Sham Perfume', 16, '#9a8a6a');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(font)}">
<rect width="100%" height="100%" fill="#fdfbf6"/>
${parts.join('\n')}
</svg>
`;
}
