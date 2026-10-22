/**
 * «دولة المنصة» — the highest authority over the robots, right under the site owner (the owner's decision, 2026-10-22).
 *
 * The owner handed it every approval the robots used to ask him for: a robot's change (pull request) and a council
 * task. It is decentralised: there is no single chief. Every member reviews the matter in its own scope and votes on
 * its own, and the decision follows the vote:
 *   - a veto from the legal manager or from security & privacy stops the matter at once (the constitution);
 *   - otherwise it passes when at least three members approve and approvals beat refusals;
 *   - a change also has to pass every check (lint, tests, both builds) before it goes live.
 * Whatever it refuses goes back to the owner with the reasons: his word is the final one.
 *
 * Above it, always: the owner. He can take the approvals back at any time (desk: approve_all / safe_auto), answer
 * anything himself first (his answer wins), freeze every robot (the State stops too) and undo any decision of the
 * State with «رجّع». It never sees the owner's personal data, his keys, or his private room, and it can't change his
 * switches, his rules or its own powers.
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
  { id: 'S-01', textAr: 'دولة المنصة أعلى سلطة على الروبوتات بعد صاحب الموقع: شاهين والمجلس والأقسام وكل الروبوتات تحت رقابتها، وكلهم بيرجعولها في كل الموافقات (تعديلات الروبوتات ومهام المجلس).' },
  { id: 'S-02', textAr: 'لا مركزية: مفيش رئيس واحد. كل عضو بيراجع الموضوع في نطاقه وبيصوّت لوحده، والقرار بالتوافق: لازم 3 موافقات على الأقل ومن غير أي اعتراض — لو عضو واحد رفض، الموضوع بيروح لصاحب الموقع بالأسباب.' },
  { id: 'S-03', textAr: 'المدير القانوني والأمن والخصوصية ليهم حق «الفيتو»: لو واحد منهم رفض، الموضوع بيقف ويروح لصاحب الموقع. قرارات المدير القانوني (زي وقف نقل المنتجات) محدش يتجاوزها.' },
  { id: 'S-04', textAr: 'أي تعديل وافقت عليه الدولة لازم يعدّي كل الفحوص (الكود والاختبارات وبناء الموقع) قبل ما ينزل الموقع؛ لو فحص واحد وقع مفيش حاجة بتتغير.' },
  { id: 'S-05', textAr: 'الدولة مابتشوفش بيانات صاحب الموقع الشخصية ولا مفاتيحه ولا غرفته الخاصة، ومابتلمسش مفاتيح التحكم بتاعته ولا قواعده ولا صلاحياتها هي نفسها.' },
  { id: 'S-06', textAr: 'الدولة خاضعة لأوامر صاحب الموقع في أي وقت: يقدر يرجّع الموافقات لنفسه، أو يرد على أي حاجة قبلها (رده هو اللي يمشي)، أو يوقف كل الروبوتات (الدولة بتقف معاهم)، أو يرجّع أي قرار ليها بزرار «رجّع». واللي ترفضه بيروحله هو بالأسباب.' },
  { id: 'S-07', textAr: 'كل قرار بيتسجل بأصوات الأعضاء وأسبابهم في سجل الدولة اللي صاحب الموقع بيشوفه في جناحه.' },
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
  /** Refused (or a check failed): it waits for the owner, with the State's reasons. */
  refused: 'رفضته دولة المنصة',
} as const;

/** The trailer on every change the State put live, so the owner's «رجّع» finds exactly what it changed. */
export const stateTrailer = (n: number) => `State-Decision: #${n}`;

/** How big a robot's change the State may approve (bigger ones go to the owner). */
export const STATE_LIMITS = { files: 20, lines: 1000, deletedFiles: 5, perRun: { pulls: 2, tasks: 10 } } as const;

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
  if (legal.length) vote('legal', 'veto', `بيلمس الوثائق أو القواعد القانونية (${list(legal)}) — ده قراري أنا وصاحب الموقع بس.`);
  else if (LEGAL_TEXT.test(text)) vote('legal', 'veto', 'الموضوع بيتكلم عن قرار قانوني ملزم — محدش يغيّره غير المدير القانوني بموافقة صاحب الموقع.');
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
  if (workflows.length) vote('quality', 'refuse', 'بيعدّل ملفات تشغيل الروبوتات، وGitHub مش سامح للروبوتات تعدّلها — دي لصاحب الموقع.');
  else if (deps.length) vote('quality', 'refuse', 'بيغيّر المكتبات الخارجية اللي الموقع معتمد عليها — ده محتاج مراجعة صاحب الموقع.');
  else if (AI_PLATFORM.test(m.added || '')) vote('quality', 'refuse', 'بيكلم منصة ذكاء اصطناعي خارجية مباشرة، وده ضد قرار صاحب الموقع (O-10).');
  else if (pull && (paths.length > STATE_LIMITS.files || (m.lines ?? 0) > STATE_LIMITS.lines)) vote('quality', 'refuse', `تعديل كبير (${paths.length} ملف، ${m.lines ?? 0} سطر) — حد الدولة ${STATE_LIMITS.files} ملف و${STATE_LIMITS.lines} سطر.`);
  else if (pull && (m.deletedFiles ?? 0) > STATE_LIMITS.deletedFiles) vote('quality', 'refuse', `بيمسح ${m.deletedFiles} ملف مرة واحدة — كتير على قرار من غير صاحب الموقع.`);
  else vote('quality', 'approve', pull ? 'الحجم معقول، وهيعدّي كل الفحوص الأول.' : 'هيتنفذ بالفحوص المعتادة.');

  // Finance: prices, payment and the bank (abstains when the matter isn't money).
  const money = hits(paths, MONEY);
  if (money.length && (m.lines ?? 0) > 150) vote('finance', 'refuse', `تعديل كبير في الأسعار أو الدفع (${list(money)}) — يروح لصاحب الموقع.`);
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
    : `❌ الدولة رفضت${tally.veto ? ' بالفيتو' : ''}: ${first ? `${stateMemberName(first.member)} — ${first.reasonAr}` : 'الموافقات مش كفاية.'} القرار النهائي لصاحب الموقع.`;
  return { approved, votes, tally, summaryAr };
}

const VOTE_MARK: Record<Vote, string> = { approve: '✅ موافق', refuse: '❌ رافض', veto: '⛔ فيتو', abstain: '➖ ممتنع' };
/** The State's answer on GitHub: the decision, then every member's vote and reason (S-07). */
export function stateComment(d: StateDecision, extra: string[] = []): string {
  return [`🏛️ **${STATE.nameAr}:** ${d.summaryAr}`, '', '| العضو | الصوت | السبب |', '|---|---|---|',
    ...d.votes.map((v) => `| ${stateMemberName(v.member)} | ${VOTE_MARK[v.vote]} | ${v.reasonAr.replace(/\|/g, '/')} |`),
    ...(extra.length ? ['', ...extra] : []), '',
    '_صاحب الموقع فوق الدولة: يقدر يغيّر أي قرار من «صندوق الموافقات» أو يرجّعه بزرار «رجّع»._'].join('\n');
}

// ── Its log (src/data/live/platform-state.json), read by the owner's suite ──────────────────────────────────
export type StateOutcome = 'approved' | 'merged' | 'refused' | 'failed';
export interface StateRecord {
  at: string; number: number; kind: 'pull' | 'task'; title: string; outcome: StateOutcome; summaryAr: string;
  tally: StateDecision['tally']; url?: string; sha?: string;
}
export interface StateReport { updatedAt: string; active: boolean; decisions: StateRecord[]; supervision: { health?: number; problems: string[] } }

export function readStateReport(data: unknown): StateReport {
  const d = (data && typeof data === 'object' ? data : {}) as Partial<StateReport>;
  const decisions = Array.isArray(d.decisions) ? d.decisions.filter((x): x is StateRecord => Boolean(x) && typeof x.number === 'number' && typeof x.title === 'string' && typeof x.outcome === 'string').slice(0, 40) : [];
  const s = (d.supervision && typeof d.supervision === 'object' ? d.supervision : {}) as Partial<StateReport['supervision']>;
  return {
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date(0).toISOString(),
    active: d.active === true,
    decisions,
    supervision: { ...(typeof s.health === 'number' ? { health: s.health } : {}), problems: Array.isArray(s.problems) ? s.problems.filter((p): p is string => typeof p === 'string').slice(0, 10) : [] },
  };
}
export const STATE_OUTCOMES: Record<StateOutcome, string> = { approved: 'وافقت (مهمة)', merged: 'وافقت ونزل الموقع', refused: 'رفضت — لصاحب الموقع', failed: 'وافقت بس الفحص وقع — لصاحب الموقع' };
