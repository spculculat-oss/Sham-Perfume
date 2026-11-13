/**
 * «دولة المنصة» — مكتب القطاعات: which sector, and which robot inside it, each finding of «مناورة التخصصات» belongs to.
 *
 * Decentralized like the State's vote: every department head claims what is his — the section he owns, and the kind
 * of problem his robots handle — and the strongest claim wins (a tie goes to the section's owner). The reason is
 * written in plain Arabic so the owner can read why. Then the State decides what to do with it: a serious error
 * becomes a task for the coding agent after the members vote, a lighter one is watched, an idea waits in the
 * sector's list (scripts/state/run.mts).
 */
import { BOTS, DEPARTMENTS, type BotId, type DeptId } from './shaheenOrg';
import { CHAT_SECTION, sectionTitle, severityRank, type ManeuverFinding, type ManeuverReport } from './maneuver';
import { STATE_LIMITS, type FieldItem, type StateField } from './platformState';

export interface SectorDecision {
  dept: DeptId;
  deptAr: string;
  /** The robot that should carry it (absent = the department head himself). */
  bot?: BotId;
  botAr?: string;
  reasonAr: string;
}

/** Who owns each section of the site. */
const SECTION_OWNER: Record<string, { dept: DeptId; bot?: BotId }> = {
  home: { dept: 'experience', bot: 'design_expert' },
  store: { dept: 'store', bot: 'catalog' },
  perfumes: { dept: 'store', bot: 'catalog' },
  cosmetics: { dept: 'store', bot: 'catalog' },
  productDetail: { dept: 'store', bot: 'product_pages' },
  concentration: { dept: 'experience', bot: 'design_expert' },
  pyramid: { dept: 'experience', bot: 'design_expert' },
  costing: { dept: 'experience', bot: 'design_expert' },
  maceration_simulator: { dept: 'experience', bot: 'design_expert' },
  guide: { dept: 'content', bot: 'teacher' },
  alcohol: { dept: 'content', bot: 'teacher' },
  raw_materials: { dept: 'content', bot: 'teacher' },
  world_perfumes: { dept: 'content', bot: 'researcher' },
  perfume_news: { dept: 'content', bot: 'news' },
  library: { dept: 'content', bot: 'librarian' },
  master_ai: { dept: 'experience', bot: 'chat' },
  [CHAT_SECTION.id]: { dept: 'experience', bot: 'chat' },
  perfume_designers: { dept: 'innovation', bot: 'lab' },
  cosmetic_designers: { dept: 'innovation', bot: 'lab' },
  molecule_studio: { dept: 'innovation', bot: 'lab' },
  community: { dept: 'experience' },
};

const STORE_SECTIONS = new Set(['store', 'perfumes', 'cosmetics', 'productDetail']);

interface Claim { dept: DeptId; bot?: BotId; score: number; whyAr: string }

/** The claims of the department heads on one finding. */
function claims(f: Pick<ManeuverFinding, 'code' | 'topic' | 'section' | 'kind'>): Claim[] {
  const out: Claim[] = [];
  const owner = SECTION_OWNER[f.section];
  if (owner) out.push({ ...owner, score: 2, whyAr: `قسم «${sectionTitle(f.section)}» تبعه` });
  const claim = (dept: DeptId, bot: BotId | undefined, score: number, whyAr: string) => out.push({ dept, bot, score, whyAr });
  switch (f.code) {
    case 'page-error': case 'http': case 'unreachable': claim('reliability', 'doctor', 3, 'عطل برمجي أو سيرفر — شغل طبيب الموقع'); break;
    case 'console': claim('reliability', 'doctor', 3, 'أخطاء في سجل المتصفح — شغل طبيب الموقع'); break;
    case 'asset-missing': claim('reliability', 'deploy', 3, 'ملفات ناقصة من النشر — شغل مسؤول النشر'); break;
    case 'slow': claim('reliability', 'doctor', 3, 'البطء — شغل قسم الجودة'); break;
    case 'blank': case 'raw-text': claim('reliability', 'doctor', 1, 'صفحة فاضية أو كلام برمجي — يراجعه طبيب الموقع مع صاحب القسم'); break;
    case 'overflow': case 'no-alt': case 'unnamed-button': case 'no-heading': claim('experience', 'design_expert', 3, 'تصميم الموبايل وسهولة الاستخدام — شغل خبير التصميم'); break;
    case 'broken-image':
      if (STORE_SECTIONS.has(f.section)) claim('store', 'images', 3, 'صور منتجات مكسورة — شغل منظف الصور');
      else claim('experience', 'design_expert', 3, 'صور مكسورة في الواجهة — شغل خبير التصميم');
      break;
    case 'chat-lang': claim('experience', 'languages', 3, 'لغة الرد غلط — شغل قسم اللغات'); break;
    case 'chat-vendor': claim('leadership', 'legal', 3, 'ظهور اسم منصة للزائر مخالف لقواعد المنصة — المدير القانوني'); break;
    case 'chat-currency': claim('store', 'store_advisor', 3, 'سعر في الشات بعملة غير عملة دولة الدخول — شغل مستشار التسوق وتسعير المتجر'); break;
    case 'chat-http': case 'chat-empty': claim('reliability', 'doctor', 3, 'الشات وقع أو مارجعش رد — شغل طبيب الموقع'); break;
    default: break;
  }
  if (f.code.startsWith('chat-') && !['chat-lang', 'chat-vendor', 'chat-http', 'chat-empty'].includes(f.code)) {
    if (f.topic === 'store') claim('store', 'store_advisor', 3, 'ترشيح وبيع من منتجات المتجر — شغل مستشار التسوق');
    else if (f.topic === 'safety') claim('experience', 'chat', 3, 'أمان الزائر في الشات — شغل شات شاهين (بإشراف الأمن والخصوصية)');
    else claim('experience', 'chat', 3, f.topic === 'relations' ? 'التعامل مع الناس والشكاوى — شغل شات شاهين' : 'فهم الأسئلة والإجابة — شغل شات شاهين');
  }
  return out;
}

const deptName = (id: DeptId) => DEPARTMENTS.find((d) => d.id === id)?.nameAr || id;
const botName = (id?: BotId) => (id ? BOTS.find((b) => b.id === id)?.nameAr : undefined);

/** The State's decision on one finding: its sector, its robot and why. */
export function stateSector(f: Pick<ManeuverFinding, 'code' | 'topic' | 'section' | 'kind'>): SectorDecision {
  const all = claims(f);
  if (!all.length) return { dept: 'leadership', deptAr: deptName('leadership'), reasonAr: 'مالهاش قسم واضح — شاهين المدير العام يوزعها' };
  // Add up each department's claims; the section's owner wins a tie.
  const totals = new Map<DeptId, { score: number; bot?: BotId; best: number; whys: string[] }>();
  for (const c of all) {
    const t = totals.get(c.dept) || { score: 0, best: -1, whys: [] };
    t.score += c.score;
    if (c.score > t.best) { t.best = c.score; t.bot = c.bot ?? t.bot; }
    t.whys.push(c.whyAr);
    totals.set(c.dept, t);
  }
  const owner = SECTION_OWNER[f.section]?.dept;
  const [dept, win] = [...totals.entries()].sort((a, b) => b[1].score - a[1].score || Number(b[0] === owner) - Number(a[0] === owner))[0];
  const bot = win.bot;
  return { dept, deptAr: deptName(dept), ...(bot ? { bot, botAr: botName(bot) } : {}), reasonAr: [...new Set(win.whys)].join('، ') };
}

export type FieldAction = 'task' | 'watch' | 'backlog';

/** What the State does with it: a high error (or a medium one seen 3 runs in a row) → a task; ideas → the sector's list. */
export function fieldAction(f: Pick<ManeuverFinding, 'kind' | 'severity' | 'seen'>): FieldAction {
  if (f.kind === 'idea') return 'backlog';
  if (f.severity === 'high' || (f.severity === 'medium' && f.seen >= 3)) return 'task';
  return 'watch';
}

/** The marker in a task issue's body that ties it to its finding (so it is never opened twice). */
export const fieldMarker = (id: string) => `<!-- maneuver:${id} -->`;

/**
 * The State files the maneuver's report: every finding classified (errors first), the task numbers it already opened
 * carried over while the finding lasts, and the errors that should become tasks now (none opened yet, worst first).
 */
export function fileField(report: ManeuverReport | undefined, before: StateField | undefined, at: string, limit: number): { field?: StateField; due: { item: FieldItem; finding: ManeuverFinding }[] } {
  if (!report) return { field: before, due: [] };
  const old = new Map((before?.items ?? []).map((i) => [i.id, i]));
  const pairs = report.findings.map((f) => {
    const s = stateSector(f);
    const had = old.get(f.id);
    const item: FieldItem = {
      id: f.id, titleAr: f.titleAr, section: f.section, sectionAr: f.sectionAr, kind: f.kind, severity: f.severity,
      dept: s.dept, deptAr: s.deptAr, ...(s.bot ? { bot: s.bot, botAr: s.botAr } : {}), reasonAr: s.reasonAr, action: fieldAction(f),
      ...(had?.issue ? { issue: had.issue } : {}), ...(had?.refused ? { refused: true as const } : {}), seen: f.seen,
    };
    return { item, finding: f };
  }).slice(0, STATE_LIMITS.fieldItems);
  const due = pairs.filter((p) => p.item.action === 'task' && !p.item.issue && !p.item.refused)
    .sort((a, b) => severityRank(b.item.severity) - severityRank(a.item.severity) || b.item.seen - a.item.seen).slice(0, limit);
  return { field: { maneuverAt: report.updatedAt, at, items: pairs.map((p) => p.item) }, due };
}

/** The task the State opens for one finding (the coding agent carries it out; the marker keeps it from opening twice). */
export function fieldTask(item: FieldItem, finding: ManeuverFinding): { title: string; body: string } {
  const sev = item.severity === 'high' ? 'خطير 🔴' : item.severity === 'medium' ? 'متوسط 🟠' : 'بسيط 🟡';
  const lines = [
    '**من «مناورة التخصصات» — دولة المنصة حددت القطاع والروبوت المسؤول.**',
    '',
    `- **القسم:** ${item.sectionAr}${finding.examinerAr ? ` (فحصه: ${finding.examinerAr})` : ''}`,
    `- **القطاع:** ${item.deptAr}`,
    `- **الروبوت المسؤول:** ${item.botAr || 'رئيس القسم نفسه'}`,
    `- **ليه القطاع ده:** ${item.reasonAr}`,
    `- **الخطورة:** ${sev} — اتشافت ${item.seen} مرة ورا بعض، أول مرة ${finding.firstSeen.slice(0, 16).replace('T', ' ')}`,
    `- **اتشافت من:** ${finding.sources.map((s) => SOURCE_AR[s]).join('، ')}`,
    ...(finding.detailAr ? ['', `**التفاصيل:** ${finding.detailAr}`] : []),
    '',
    'المطلوب: إصلاح السبب من جذوره مع اختبار يمنع رجوعه. المناورة الجاية بتتأكد بنفسها إنه اتحل.',
    '',
    fieldMarker(item.id),
  ];
  return { title: `مهمة شاهين: [${item.deptAr}] ${item.titleAr}`.slice(0, 200), body: lines.join('\n') };
}

const SOURCE_AR: Record<ManeuverFinding['sources'][number], string> = {
  browser: 'المتصفح على الموبايل', 'chat-live': 'محادثة حية مع شاهين', brain: 'تدريب مخ شاهين', rules: 'القواعد', ai: 'مراجع التحسينات',
};
