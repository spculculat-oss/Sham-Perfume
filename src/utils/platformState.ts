/**
 * «دولة المنصة» — the highest authority over the robots, right under the site owner (the owner's decision, 2026-10-22).
 *
 * The owner handed it every approval the robots used to ask him for: a robot's change (pull request) and a council
 * task. It is decentralised: there is no single chief. Every member reviews the matter in its own scope and votes on
 * its own, and the decision follows the vote:
 *   - a veto from the legal manager or from security & privacy stops the matter at once (the constitution);
 *   - otherwise it passes by consensus: at least three approvals and no objection;
 *   - a change also has to pass every check (lint, tests, both builds) before it goes live.
 * It never goes back to the owner (his decision, 2026-10-22): what it refuses it closes itself, with the reasons. Every
 * worker of the platform — Shaheen first — takes its approvals from the State and follows its laws. It also gives the
 * robots orders and carries them out itself (pause / resume / run now) and keeps the platform's laws (add / repeal),
 * and the owner talks with it in its private room in his suite.
 *
 * Above it, always: the owner. He can take the approvals back at any time (desk: approve_all / safe_auto), answer
 * anything himself first (his answer wins), resume what it paused, freeze every robot (the State stops too) and undo
 * any decision of the State with «رجّع». It never sees the owner's personal data, his keys, or his private room, and
 * it can't change his switches, his rules or its own powers.
 *
 * It is the robots' own deliberation, with no outside AI platform (rule O-10): every vote is a rule its member
 * applies to the facts of the matter. Pure (browser-safe): the State's robot (scripts/state/run.mts), the owner's
 * suite and the tests all read it.
 */
import { hasSensitiveNumber, type OwnerControls } from './ownerAuthority';

export const STATE = {
  nameAr: 'دولة المنصة',
  nameEn: 'The Platform State',
  /** Where it sits: right under the owner, above Shaheen, the council and every department. */
  placeAr: 'أعلى سلطة على الروبوتات بعد صاحب الموقع: فوق شاهين والمجلس وكل الأقسام، وكلهم تحت رقابتها.',
} as const;

/** Its constitution: what it may do and where its power ends. Shown in the owner's suite and the robots' handbook. */
export const STATE_CONSTITUTION: { id: string; textAr: string }[] = [
  { id: 'S-01', textAr: 'دولة المنصة أعلى سلطة على الروبوتات بعد صاحب الموقع: شاهين والمجلس والأقسام وكل الروبوتات تحت رقابتها، وكل العاملين في المنصة — وأولهم شاهين — خاضعين لقوانينها وبياخدوا منها كل الاعتمادات والموافقات (تعديلات الروبوتات ومهام المجلس).' },
  { id: 'S-02', textAr: 'لا مركزية: مفيش رئيس واحد. كل عضو بيراجع الموضوع في نطاقه وبيصوّت لوحده، والقرار بالتوافق: لازم 3 موافقات على الأقل ومن غير أي اعتراض — لو عضو واحد رفض، الدولة بترفض وبتقفل الموضوع بنفسها وبتكتب الأسباب.' },
  { id: 'S-03', textAr: 'المدير القانوني والأمن والخصوصية ليهم حق «الفيتو»: لو واحد منهم رفض، الموضوع بيقف ويتقفل. قرارات المدير القانوني (زي وقف نقل المنتجات) محدش يتجاوزها.' },
  { id: 'S-04', textAr: 'أي تعديل وافقت عليه الدولة لازم يعدّي كل الفحوص (الكود والاختبارات وبناء الموقع) قبل ما ينزل الموقع؛ لو فحص واحد وقع مفيش حاجة بتتغير.' },
  { id: 'S-05', textAr: 'الدولة مابتشوفش بيانات صاحب الموقع الشخصية ولا مفاتيحه ولا غرفته الخاصة، ومابتلمسش مفاتيح التحكم بتاعته ولا قواعده ولا صلاحياتها هي نفسها.' },
  { id: 'S-06', textAr: 'الدولة خاضعة لأوامر صاحب الموقع في أي وقت: يقدر يرجّع الموافقات لنفسه، أو يرد على أي حاجة قبلها (رده هو اللي يمشي)، أو يوقف كل الروبوتات (الدولة بتقف معاهم)، أو يرجّع أي قرار ليها بزرار «رجّع»، أو يرجّع روبوت هي وقفته. والدولة مابترجعلوش في أي إجراء: بتقرر وبتنفذ بنفسها.' },
  { id: 'S-07', textAr: 'كل قرار بيتسجل بأصوات الأعضاء وأسبابهم في سجل الدولة اللي صاحب الموقع بيشوفه في جناحه.' },
  { id: 'S-08', textAr: 'الدولة ليها صلاحية تفعيل الأوامر: توقف أي روبوت أو ترجّعه أو تشغّله دلوقتي، وتضيف قوانين للمنصة أو تلغيها — بعد ما تتأكد إن الأمر صح من وجهة نظرها. أوامر صاحب الموقع فوق أوامرها.' },
  { id: 'S-09', textAr: 'صاحب الموقع بيناقش الدولة في غرفتها الخاصة في جناحه (الأوامر والمستجدات والقوانين). الكلام بيتحفظ متشفر على جهازه بس.' },
  { id: 'S-10', textAr: 'الربط المباشر بين وكيل شاهين وشاهين تحت نظر الدولة: الوكيل بيفكر مع شاهين في كل سؤال الأول (سياق المحادثة، ومنتجات المتجر بمكوناتها وأسعارها، ومصمم التركيبات، ودروس المدرسة) ويطلع رد واحد مترابط، والمنصات الخارجية بس للي مالوش فيه إجابة أكيدة. كل رد بيتكتب مصدره ودرجة ثقته، والدولة تقدر توقف الربط أو ترجّعه بأمر (agent_link)، وأمر صاحب الموقع فوقها.' },
];

export type StateMemberId = 'shaheen' | 'legal' | 'privacy' | 'quality' | 'finance' | 'department';
export interface StateMember { id: StateMemberId; nameAr: string; scopeAr: string; veto?: boolean }
export const STATE_MEMBERS: StateMember[] = [
  { id: 'shaheen', nameAr: 'الخبير شاهين — الإدارة العامة', scopeAr: 'إن الموضوع واضح ومفيد للموقع وجاي من روبوت معروف' },
  { id: 'legal', nameAr: 'المدير القانوني', scopeAr: 'القوانين والوثائق القانونية وقراراته الملزمة', veto: true },
  { id: 'privacy', nameAr: 'الأمن والخصوصية', scopeAr: 'بيانات صاحب الموقع ومفاتيحه وصلاحياته، والأرقام الشخصية', veto: true },
  { id: 'quality', nameAr: 'الجودة والاعتماد على النفس', scopeAr: 'حجم التعديل، ملفات التشغيل، المكتبات الخارجية، وعدم الاعتماد على منصات ذكاء اصطناعي' },
  { id: 'finance', nameAr: 'أمين المالية', scopeAr: 'الأسعار والدفع والبنك' },
  { id: 'department', nameAr: 'رئيس القسم المختص', scopeAr: 'إن الشغل في نطاق قسمه' },
];
export const stateMemberName = (id: StateMemberId) => STATE_MEMBERS.find((m) => m.id === id)?.nameAr ?? id;

/** Labels the State puts on what it reviewed (the owner's inbox reads them). */
export const STATE_LABELS = {
  /** A council task the State approved: the coding agent may carry it out, like one the owner approved. */
  approvedTask: 'approved-by-state',
  reviewed: 'راجعته دولة المنصة',
  /** Refused (or a check failed): the State closed it itself, with its reasons. */
  refused: 'رفضته دولة المنصة',
} as const;

/** The trailer on every change the State put live, so the owner's «رجّع» finds exactly what it changed. */
export const stateTrailer = (n: number) => `State-Decision: #${n}`;

/** How big a robot's change the State may approve (bigger ones go to the owner). */
export const STATE_LIMITS = { files: 20, lines: 1000, deletedFiles: 5, perRun: { pulls: 4, tasks: 10, orders: 10, reruns: 2, maneuver: 3 }, fieldItems: 60 } as const;

/** The State decides only while the owner handed it the approvals and the robots are not frozen. */
export const stateActive = (c: OwnerControls) => c.selfDevelopment === 'state' && !c.frozen;

// ── What each member looks at ───────────────────────────────────────────────────────────────────────────────
/** The owner's own zone: his switches, rules, desk, private room — and the State's powers. Never the State's call. */
const OWNER_ZONE = [/^src\/data\/owner\//, /^scripts\/owner\//, /ownerAuthority/, /platformState/, /^scripts\/state\//, /ownerRoom/i, /OwnerRoom/, /ownerFiles/, /ownerDesk/i, /OwnerSuite/, /OwnerInbox/, /adminApi/];
const SECRETS = [/(^|\/)\.env/, /\.(pem|key|p12)$/i, /(^|\/)secrets?\//i];
const LEGAL = [/(^|\/)legal\//i, /legalExpert|complianceMatrix|legalHold/i, /(^|\/)LICENSE/];
const MONEY = [/pricing|shipping|checkout|kashier|payment|bank|finance|invoice|currency|fx-?rates/i];
const WORKFLOWS = [/^\.github\//];
const DEPENDENCIES = [/(^|\/)package(-lock)?\.json$/, /(^|\/)bun\.lockb?$/, /(^|\/)\.npmrc$/];
/** Calling an outside AI platform directly is against rule O-10 (the owner closed them). */
const AI_PLATFORM = /generativelanguage\.googleapis|api\.openai\.com|api\.anthropic\.com|api\.deepseek\.com|openrouter\.ai\/api|api\.perplexity\.ai|api\.manus\.ai/i;
const LEGAL_TEXT = /المدير القانوني|قرار قانوني|\bL-\d{2}\b|docs\/legal|src\/legal|وقف (?:نقل|استيراد) المنتجات|إذن المورد/;
const OWNER_TEXT = /بيانات صاحب الموقع|البيانات الشخصية لصاحب|مفاتيح صاحب الموقع|SHAM_ADMIN_TOKEN|controls\.json|ownerAuthority|غرفة شاهين الخاصة|صلاحيات (?:دولة المنصة|الدولة)/;

const DEPARTMENTS: { nameAr: string; re: RegExp }[] = [
  { nameAr: 'قسم المتجر والاستيراد', re: /store|import|product|catalog|scout|merchant|supplier|متجر|منتج|استيراد|مورد|كتالوج/i },
  { nameAr: 'قسم المحتوى والظهور في البحث', re: /news|seo|lesson|library|book|sitemap|article|أخبار|دروس|مكتبة|بحث جوجل|محركات البحث/i },
  { nameAr: 'قسم تجربة الزائر والتصميم واللغات', re: /components|chat|l10n|i18n|لغات|locale|design|style|css|tsx$|page|الشات|تصميم|اللغات|الموبايل|الزائر/i },
  { nameAr: 'قسم الجودة والاعتماد على النفس', re: /server\/|scripts\/|tests?\/|ci\/|doctor|patrol|engine|health|deploy|اختبار|فحص|الخادم|روبوت|سرعة/i },
];

export type Vote = 'approve' | 'refuse' | 'veto' | 'abstain';
export interface MemberVote { member: StateMemberId; vote: Vote; reasonAr: string }
export interface StateMatter {
  kind: 'pull' | 'task';
  title: string;
  body?: string | null;
  /** For a robot's change: the files it touches, the changed lines, how many it deletes, and the added lines. */
  paths?: string[];
  lines?: number;
  deletedFiles?: number;
  added?: string;
}
export interface StateDecision { approved: boolean; votes: MemberVote[]; tally: { approve: number; refuse: number; veto: number }; summaryAr: string }

const hits = (paths: string[], rules: RegExp[]) => paths.filter((p) => rules.some((r) => r.test(p)));
const list = (paths: string[]) => paths.slice(0, 3).map((p) => `«${p}»`).join('، ') + (paths.length > 3 ? ` و${paths.length - 3} غيرهم` : '');

/** Every member's vote on the matter, then the decision (S-02, S-03). The checks come after an approval (S-04). */
export function stateVote(m: StateMatter): StateDecision {
  const paths = m.paths || [];
  const text = `${m.title}\n${m.body || ''}`;
  const pull = m.kind === 'pull';
  const votes: MemberVote[] = [];
  const vote = (member: StateMemberId, v: Vote, reasonAr: string) => votes.push({ member, vote: v, reasonAr });

  // Shaheen: something clear to do.
  if (pull && !paths.length) vote('shaheen', 'refuse', 'التعديل مافيهوش أي ملف — مفيش حاجة توافق عليها.');
  else if (m.title.trim().length < 6) vote('shaheen', 'refuse', 'العنوان مش واضح كفاية علشان أعرف التعديل بيعمل إيه.');
  else vote('shaheen', 'approve', pull ? 'تعديل واضح من روبوت معروف، وهيتفحص كله قبل ما ينزل.' : 'مهمة واضحة من اجتماع شاهين، ووكيل البرمجة هيفحص كل تعديل منها.');

  // The legal manager (veto): the law and his binding decisions.
  const legal = hits(paths, LEGAL);
  if (legal.length) vote('legal', 'veto', `بيلمس الوثائق أو القواعد القانونية (${list(legal)}) — دي برّه سلطة الدولة.`);
  else if (LEGAL_TEXT.test(text)) vote('legal', 'veto', 'الموضوع بيتكلم عن قرار قانوني ملزم — محدش يتجاوزه.');
  else vote('legal', 'approve', 'مفيش فيه حاجة قانونية.');

  // Security & privacy (veto): the owner's data, keys, switches and rules — and the State's own powers.
  const owner = hits(paths, OWNER_ZONE);
  const secrets = hits(paths, SECRETS);
  if (owner.length) vote('privacy', 'veto', `بيلمس منطقة صاحب الموقع أو صلاحيات الدولة (${list(owner)}) — دي برّه سلطة الدولة.`);
  else if (secrets.length) vote('privacy', 'veto', `بيلمس ملفات مفاتيح أو أسرار (${list(secrets)}).`);
  else if (hasSensitiveNumber(`${text}\n${m.added || ''}`)) vote('privacy', 'veto', 'فيه رقم شكله رقم بطاقة أو رقم قومي أو حساب — ممنوع يتكتب في الموقع.');
  else if (OWNER_TEXT.test(text)) vote('privacy', 'veto', 'الموضوع عن بيانات صاحب الموقع أو مفاتيحه أو صلاحياته — دي ليه هو بس.');
  else vote('privacy', 'approve', 'مابيلمسش بيانات صاحب الموقع ولا مفاتيحه.');

  // Quality & self-reliance: size, the robots' workflow files, outside libraries, outside AI platforms.
  const workflows = hits(paths, WORKFLOWS);
  const deps = hits(paths, DEPENDENCIES);
  if (workflows.length) vote('quality', 'refuse', 'بيعدّل ملفات تشغيل الروبوتات، وGitHub مش سامح للروبوتات تعدّلها — بتتعمل من شات وكيل البرمجة.');
  else if (deps.length) vote('quality', 'refuse', 'بيغيّر المكتبات الخارجية اللي الموقع معتمد عليها — والدولة مابتغيرهاش من غير وكيل البرمجة.');
  else if (AI_PLATFORM.test(m.added || '')) vote('quality', 'refuse', 'بيكلم منصة ذكاء اصطناعي خارجية مباشرة، وده ضد قرار صاحب الموقع (O-10).');
  else if (pull && (paths.length > STATE_LIMITS.files || (m.lines ?? 0) > STATE_LIMITS.lines)) vote('quality', 'refuse', `تعديل كبير (${paths.length} ملف، ${m.lines ?? 0} سطر) — حد الدولة ${STATE_LIMITS.files} ملف و${STATE_LIMITS.lines} سطر.`);
  else if (pull && (m.deletedFiles ?? 0) > STATE_LIMITS.deletedFiles) vote('quality', 'refuse', `بيمسح ${m.deletedFiles} ملف مرة واحدة — كتير على تعديل واحد.`);
  else vote('quality', 'approve', pull ? 'الحجم معقول، وهيعدّي كل الفحوص الأول.' : 'هيتنفذ بالفحوص المعتادة.');

  // Finance: prices, payment and the bank (abstains when the matter isn't money).
  const money = hits(paths, MONEY);
  if (money.length && (m.lines ?? 0) > 150) vote('finance', 'refuse', `تعديل كبير في الأسعار أو الدفع (${list(money)}) — يتقسم لتعديلات أصغر.`);
  else if (money.length) vote('finance', 'approve', `تعديل صغير في ملفات الفلوس (${list(money)})، ومفيش أي تحويل فلوس بيحصل تلقائي.`);
  else if (!pull && /سعر|أسعار|الدفع|البنك|فلوس|تحويل|استرداد|price|payment|bank|refund/i.test(text)) vote('finance', 'approve', 'مهمة فيها فلوس: مفيش تحويلات أو استردادات تلقائي، وأي تعديل منها هيتفحص.');
  else vote('finance', 'abstain', 'مش في نطاقي.');

  // The department head whose area it is.
  const scope = pull ? paths.join('\n') : text;
  const dept = DEPARTMENTS.find((d) => d.re.test(scope));
  if (dept) vote('department', 'approve', `في نطاق ${dept.nameAr}.`);
  else vote('department', 'abstain', 'مش واضح هو تبع أنهي قسم.');

  const tally = { approve: votes.filter((v) => v.vote === 'approve').length, refuse: votes.filter((v) => v.vote === 'refuse').length, veto: votes.filter((v) => v.vote === 'veto').length };
  const approved = tally.veto === 0 && tally.refuse === 0 && tally.approve >= 3;
  const first = votes.find((v) => v.vote === 'veto') || votes.find((v) => v.vote === 'refuse');
  const summaryAr = approved
    ? `✅ الدولة وافقت (${tally.approve} موافقة${tally.refuse ? ` و${tally.refuse} رفض` : ''}).`
    : `❌ الدولة رفضت${tally.veto ? ' بالفيتو' : ''}: ${first ? `${stateMemberName(first.member)} — ${first.reasonAr}` : 'الموافقات مش كفاية.'} الدولة قفلت الموضوع.`;
  return { approved, votes, tally, summaryAr };
}

const VOTE_MARK: Record<Vote, string> = { approve: '✅ موافق', refuse: '❌ رافض', veto: '⛔ فيتو', abstain: '➖ ممتنع' };
/** The State's answer on GitHub: the decision, then every member's vote and reason (S-07). */
export function stateComment(d: StateDecision, extra: string[] = []): string {
  return [`🏛️ **${STATE.nameAr}:** ${d.summaryAr}`, '', '| العضو | الصوت | السبب |', '|---|---|---|',
    ...d.votes.map((v) => `| ${stateMemberName(v.member)} | ${VOTE_MARK[v.vote]} | ${v.reasonAr.replace(/\|/g, '/')} |`),
    ...(extra.length ? ['', ...extra] : []), '',
    '_قرار دولة المنصة نهائي. صاحب الموقع وحده فوقها ويقدر يرجّع أي قرار بزرار «رجّع»._'].join('\n');
}

// ── Its log (src/data/live/platform-state.json), read by the owner's suite ──────────────────────────────────
export type StateOutcome = 'approved' | 'merged' | 'refused' | 'failed';
export interface StateRecord {
  at: string; number: number; kind: 'pull' | 'task'; title: string; outcome: StateOutcome; summaryAr: string;
  tally: StateDecision['tally']; url?: string; sha?: string;
}
/**
 * «مناورة التخصصات» as the State filed it (src/utils/stateSectors.ts): each finding of the field maneuver with the
 * sector and robot it belongs to, why, and what the State did with it (a task, watched, or the sector's ideas list).
 */
export interface FieldItem {
  id: string; titleAr: string; section: string; sectionAr: string; kind: 'error' | 'idea'; severity: 'high' | 'medium' | 'low';
  dept: string; deptAr: string; bot?: string; botAr?: string; reasonAr: string; action: 'task' | 'watch' | 'backlog'; issue?: number; refused?: true; seen: number;
}
export interface StateField { maneuverAt: string; at: string; items: FieldItem[] }
export interface StateReport { updatedAt: string; active: boolean; decisions: StateRecord[]; supervision: { health?: number; problems: string[] }; field?: StateField }

const fieldStr = (v: unknown, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');
export function readStateField(data: unknown): StateField | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (!fieldStr(d.maneuverAt, 40)) return undefined;
  const items = (Array.isArray(d.items) ? d.items : []).flatMap((x): FieldItem[] => {
    if (!x || typeof x !== 'object') return [];
    const i = x as Record<string, unknown>;
    const kind = i.kind === 'idea' ? 'idea' : i.kind === 'error' ? 'error' : undefined;
    const action = i.action === 'task' || i.action === 'watch' || i.action === 'backlog' ? i.action : undefined;
    if (!kind || !action || !fieldStr(i.id, 160) || !fieldStr(i.titleAr) || !fieldStr(i.dept, 40)) return [];
    const severity = i.severity === 'high' || i.severity === 'medium' ? i.severity : 'low';
    return [{
      id: fieldStr(i.id, 160), titleAr: fieldStr(i.titleAr), section: fieldStr(i.section, 60), sectionAr: fieldStr(i.sectionAr, 120), kind, severity,
      dept: fieldStr(i.dept, 40), deptAr: fieldStr(i.deptAr, 120), ...(fieldStr(i.bot, 40) ? { bot: fieldStr(i.bot, 40) } : {}), ...(fieldStr(i.botAr, 160) ? { botAr: fieldStr(i.botAr, 160) } : {}),
      reasonAr: fieldStr(i.reasonAr), action, ...(typeof i.issue === 'number' ? { issue: i.issue } : {}), ...(i.refused === true ? { refused: true as const } : {}), seen: Math.max(1, Number(i.seen) || 1),
    }];
  }).slice(0, STATE_LIMITS.fieldItems);
  return { maneuverAt: fieldStr(d.maneuverAt, 40), at: fieldStr(d.at, 40), items };
}

export function readStateReport(data: unknown): StateReport {
  const d = (data && typeof data === 'object' ? data : {}) as Partial<StateReport>;
  const decisions = Array.isArray(d.decisions) ? d.decisions.filter((x): x is StateRecord => Boolean(x) && typeof x.number === 'number' && typeof x.title === 'string' && typeof x.outcome === 'string').slice(0, 40) : [];
  const s = (d.supervision && typeof d.supervision === 'object' ? d.supervision : {}) as Partial<StateReport['supervision']>;
  return {
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date(0).toISOString(),
    active: d.active === true,
    decisions,
    supervision: { ...(typeof s.health === 'number' ? { health: s.health } : {}), problems: Array.isArray(s.problems) ? s.problems.filter((p): p is string => typeof p === 'string').slice(0, 10) : [] },
    ...(readStateField(d.field) ? { field: readStateField(d.field) } : {}),
  };
}
export const STATE_OUTCOMES: Record<StateOutcome, string> = { approved: 'وافقت (مهمة)', merged: 'وافقت ونزل الموقع', refused: 'رفضت وقفلته', failed: 'وافقت بس الفحص وقع — اتقفل' };

// ── Its orders and the platform's laws (src/data/owner/state-orders.json) ───────────────────────────────────────
/**
 * The State's own orders file. It lives next to the owner's switches so every robot's first job (gate.mjs, which
 * reads only src/data/owner) obeys it too, and no robot's change can touch it (the privacy veto guards the owner's
 * zone). Only the State's robot writes it; the owner's «رجّع روبوت» from his desk clears the State's pause as well.
 */
export const STATE_ORDERS_FILE = 'src/data/owner/state-orders.json';
export type StateOrderAction = 'pause' | 'resume' | 'run' | 'law' | 'repeal';
export interface StateLaw { id: string; textAr: string; at: string }
export interface StateOrderEntry { at: string; action: StateOrderAction; target?: string; noteAr: string; by: 'state' | 'owner' }
export interface StateOrders { paused: string[]; laws: StateLaw[]; log: StateOrderEntry[] }
export const STATE_ORDERS_LIMITS = { laws: 40, lawChars: 400, log: 60 } as const;
export const emptyStateOrders = (): StateOrders => ({ paused: [], laws: [], log: [] });

export function readStateOrders(data: unknown): StateOrders {
  const d = (data && typeof data === 'object' ? data : {}) as Partial<StateOrders>;
  const str = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
  return {
    paused: Array.isArray(d.paused) ? [...new Set(d.paused.filter(str))] : [],
    laws: Array.isArray(d.laws) ? d.laws.filter((l): l is StateLaw => Boolean(l) && str(l.id) && str(l.textAr)).map((l) => ({ id: l.id, textAr: l.textAr.slice(0, STATE_ORDERS_LIMITS.lawChars), at: str(l.at) ? l.at : '' })).slice(0, STATE_ORDERS_LIMITS.laws) : [],
    log: Array.isArray(d.log) ? d.log.filter((e): e is StateOrderEntry => Boolean(e) && str(e.at) && str(e.action) && typeof e.noteAr === 'string').slice(0, STATE_ORDERS_LIMITS.log) : [],
  };
}

/** The next free law number: P-01, P-02, … (never reused, so a repealed law's number stays its own). */
export function nextLawId(orders: StateOrders): string {
  const used = [...orders.laws.map((l) => l.id), ...orders.log.filter((e) => e.action === 'law' && e.target).map((e) => e.target!)];
  const n = used.reduce((m, id) => Math.max(m, Number(/^P-(\d+)$/.exec(id)?.[1] || 0)), 0) + 1;
  return `P-${String(n).padStart(2, '0')}`;
}
