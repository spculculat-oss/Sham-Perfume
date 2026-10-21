import { bookStudyBriefing } from '../../server/library/bookStudyArchive';
/**
 * «مجلس شاهين» — the daily development meeting. «الخبير شاهين», manager of every AI tool on the site,
 * chairs five specialist seats (tools quality, store & import, content & SEO, visitor experience, reliability).
 *   1. Briefing (no AI): the real state of the site from the bots' own reports (src/data/live/*.json).
 *   2. Opinions: each seat reads the briefing and proposes improvements in its specialty (one engine each
 *      when several keys exist; any seat may fail).
 *   3. Minutes: Shaheen (chair) merges them into decisions. Safe ones are applied at once from a fixed
 *      list (rerun a bot, a question for «مدرسة شاهين», a store for «كشّاف المصادر», a development goal for
 *      a tool); everything else becomes a development task for the coding agent (GitHub issue
 *      «shaheen-task») — big or risky ones wait for the merchant's approval.
 * Without any AI engine the meeting still happens: the minutes are written from the briefing's rules.
 * Pure helpers here; scripts/shaheen-council/run.mts does the I/O.
 */
import { existsSync, readFileSync } from 'node:fs';
import { libraryReviewBriefing } from '../../src/library/reviewHandoff';
import { AI_TOOLS, type AiToolId } from '../../src/utils/aiTools';
import { similarity } from '../../src/utils/shaheenMemory';
import { botOf } from '../../src/utils/shaheenOrg';
import type { PrecheckFile } from './precheck';

export type SeatId = 'manager' | 'store' | 'content' | 'experience' | 'reliability' | 'field';
export type Priority = 'high' | 'medium' | 'low';
export type Area = 'ai-tools' | 'store' | 'content' | 'experience' | 'reliability';
export type Action =
  | { type: 'rerun'; workflow: Rerunnable }
  | { type: 'study'; question: string }
  | { type: 'scout-seed'; domain: string };

export const RERUNNABLE = ['shaheen-import.yml', 'shaheen-discover.yml', 'shaheen-news.yml', 'shaheen-seo.yml'] as const;
export type Rerunnable = (typeof RERUNNABLE)[number];

export interface Seat { id: SeatId; titleAr: string; titleEn: string; brief: string; area: Area }
export const SEATS: Seat[] = [
  { id: 'manager', titleAr: 'شاهين — مدير أدوات الذكاء الاصطناعي', titleEn: 'Shaheen — AI tools manager', area: 'ai-tools', brief: 'quality of every AI tool (scores, issues, guidance), what each tool should get better at in its own specialty' },
  { id: 'store', titleAr: 'خبير المتجر والاستيراد', titleEn: 'Store & import expert', area: 'store', brief: 'the store catalog, imported products, new supplier stores, prices (product price + 50% margin + shipping), photos, product pages, checkout' },
  { id: 'content', titleAr: 'خبير المحتوى والظهور في البحث', titleEn: 'Content & search expert', area: 'content', brief: 'news, lessons, SEO findings, product descriptions, what brings visitors from search engines and social media' },
  { id: 'experience', titleAr: 'خبير تجربة الزائر والتصميم واللغات', titleEn: 'Visitor experience, design & languages expert', area: 'experience', brief: 'what a visitor sees and does on GitHub Pages: design, mobile, languages, the chat with Shaheen, the calculators, community' },
  { id: 'reliability', titleAr: 'خبير الجودة والاعتماد على النفس', titleEn: 'Reliability & self-reliance expert', area: 'reliability', brief: 'failing checks, used-up AI quotas, answering without AI («مدرسة شاهين»), backups, keeping every bot running' },
];
/**
 * «المستشار الميداني» — the sixth seat: Shaheen's background agent, the only member who really opened the
 * live site this morning (the daily tour, scripts/shaheen-manus/missions.ts). His opinion is written before the
 * meeting (an agent task takes minutes), so the meeting reads it instead of asking an engine.
 */
export const FIELD_SEAT: Seat = { id: 'field', titleAr: 'المستشار الميداني (جرّب الموقع الحي الصبح)', titleEn: 'Field advisor (tried the live site this morning)', area: 'experience', brief: 'what really happens on the live site today: the shopping journey on a phone and the visible problems' };
export const seatTitle = (id: SeatId) => (id === 'field' ? FIELD_SEAT : SEATS.find((s) => s.id === id))?.titleAr || id;

/** The field advisor's opinion when this morning's tour wrote one (at most 8 hours old). */
export function fieldOpinion(missions: unknown, now: number): SeatOpinion | undefined {
  const tour = o(o(missions).tour);
  const adv = o(tour.advisor);
  const age = hoursSince(tour.at, now);
  if (age === undefined || age > 8 || typeof adv.opinionAr !== 'string' || adv.opinionAr.length < 40) return undefined;
  const proposals = (Array.isArray(adv.proposals) ? adv.proposals as unknown[] : []).map(o);
  const journey = (Array.isArray(tour.journey) ? tour.journey as unknown[] : []).map(o);
  const broken = journey.filter((s) => s.ok === false).map((s) => String(s.step));
  const text = [
    adv.opinionAr,
    `رحلة الشراء من الموبايل: ${n(tour.score) ?? '—'}/100${broken.length ? ` — خطوات واقعة: ${broken.join('، ')}` : ' — كل الخطوات سليمة'}.`,
    proposals.length ? `اقتراحاتي:\n${proposals.map((p, i) => `${i + 1}. [${String(p.priority)}] ${String(p.title)} — ${String(p.detail)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  return { seat: 'field', engine: 'manus', ok: true, text: text.slice(0, 4000) };
}

export interface Signal { area: Area; priority: Priority; text: string; decision?: Omit<Decision, 'id' | 'status'> }
export interface Briefing { at: string; facts: string[]; signals: Signal[] }

export interface Decision {
  id: string;
  title: string;
  detail: string;
  area: Area;
  priority: Priority;
  /** auto = applied by the meeting itself; task = a development task for the coding agent. */
  kind: 'auto' | 'task';
  action?: Action;
  tool?: AiToolId;
  /** Big or risky: the coding agent asks the merchant first. */
  needsApproval?: boolean;
  status: 'applied' | 'queued' | 'skipped';
  note?: string;
  /** Taken by the secretary on Shaheen's behalf (routine items, or the whole meeting under pressure). */
  by?: 'secretary';
}

export interface SeatOpinion { seat: SeatId; engine?: string; ok: boolean; text: string }
export interface Meeting {
  date: string;
  at: string;
  mode: 'ai' | 'self';
  summaryAr: string;
  seats: SeatOpinion[];
  decisions: Decision[];
  toolGoals: Partial<Record<AiToolId, string>>;
  chairEngine?: string;
  /** Who chaired: Shaheen, or his secretary («مشرف شاهين») deputising — and why. */
  chair?: 'shaheen' | 'secretary';
  deputyReasons?: string[];
}
export interface Task {
  id: string;
  title: string;
  detail: string;
  area: Area;
  priority: Priority;
  needsApproval: boolean;
  createdAt: string;
  meeting: string;
  status: 'open' | 'done' | 'dropped';
  issue?: number;
  url?: string;
  closedAt?: string;
}
export interface CouncilFile {
  version: 1;
  updatedAt: string;
  meetings: Meeting[];
  tasks: Task[];
  /** Latest development goal per tool (the supervisor steers that tool's guidance toward it). */
  toolGoals: Partial<Record<AiToolId, { text: string; since: string }>>;
  /** Questions «مدرسة شاهين» studies next, stores «كشّاف المصادر» checks next (from the meetings). */
  study: { q: string; at: string }[];
  seeds: { domain: string; at: string }[];
  /** What the secretary did on Shaheen's behalf; Shaheen reviews it at his next meeting (reviewedAt). */
  delegations?: Delegation[];
}
export interface Delegation { date: string; at: string; reasons: string[]; decisions: string[]; reviewedAt?: string }

export const emptyCouncil = (): CouncilFile => ({ version: 1, updatedAt: new Date(0).toISOString(), meetings: [], tasks: [], toolGoals: {}, study: [], seeds: [] });
export const isCouncilFile = (d: unknown): d is CouncilFile =>
  Boolean(d && typeof d === 'object' && (d as CouncilFile).version === 1 && Array.isArray((d as CouncilFile).meetings) && Array.isArray((d as CouncilFile).tasks));

/** The meeting day in Cairo (one meeting a day). */
export const cairoDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

// ── 1. Briefing ─────────────────────────────────────────────────────────────────────────────────────────────
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' ? v as Obj : {});
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const hoursSince = (iso: unknown, now: number) => (typeof iso === 'string' && Date.parse(iso) > 0 ? (now - Date.parse(iso)) / 3600_000 : undefined);

export interface LiveData {
  supervisor?: unknown; school?: unknown; sources?: unknown; review?: unknown; seo?: unknown; news?: unknown; quota?: unknown; skills?: unknown; manus?: unknown; intake?: unknown;
  /** «وكيل اللغات» — digit systems following the site language, bare-locale formatting, pack coverage. */
  languages?: unknown;
  /** «الفحص الشامل قبل الاجتماع» (precheck.ts): every robot's own check, two hours before the meeting. */
  precheck?: unknown;
  /** The background agent's missions (scripts/shaheen-manus/missions.ts): the visitor tour and the external reviewer. */
  missions?: unknown;
}

/** What the bots report, in plain Arabic lines, plus rule-based signals (the agenda; the minutes without AI). */
export function buildBriefing(d: LiveData, now: number, openTasks: Task[] = []): Briefing {
  const facts: string[] = [...libraryReviewBriefing(), ...bookStudyBriefing()];
  const signals: Signal[] = [];
  const push = (s: Signal) => signals.push(s);

  // AI tools (the supervisor's scores)
  const tools = o(o(d.supervisor).tools);
  const overall = n(o(d.supervisor).overall);
  if (Object.keys(tools).length) {
    facts.push(`أدوات الذكاء الاصطناعي: متوسط التقييم ${overall ?? '—'}/10 — ${Object.entries(tools).map(([id, t]) => `${o(t).nameAr || id} ${n(o(t).score) ?? n(o(t).autoScore) ?? '—'}`).join('، ')}`);
    for (const [id, raw] of Object.entries(tools)) {
      const t = o(raw);
      const score = n(t.score) ?? n(t.autoScore);
      const issues = (Array.isArray(t.issues) ? t.issues : []).map(String).slice(0, 2);
      if (t.status === 'fail' || (score !== undefined && score < 6)) {
        push({ area: 'ai-tools', priority: 'high', text: `أداة ${t.nameAr || id} ضعيفة (${score ?? 'فشل'}/10): ${issues.join('، ') || String(t.error || '')}`,
          decision: { title: `رفع جودة ${t.nameAr || id}`, detail: `التقييم ${score ?? '—'}/10. الملاحظات: ${issues.join('، ') || 'فشل الفحص'}. راجع الكود والتعليمات وأصلح السبب.`, area: 'ai-tools', priority: 'high', kind: 'task', tool: AI_TOOLS.some((x) => x.id === id) ? id as AiToolId : undefined } });
      } else if (score !== undefined && score < 8 && issues.length) {
        push({ area: 'ai-tools', priority: 'medium', text: `أداة ${t.nameAr || id} تحتاج تحسيناً (${score}/10): ${issues.join('، ')}` });
      }
    }
  } else facts.push('لا يوجد تقرير من مشرف أدوات الذكاء الاصطناعي بعد.');

  // AI quota
  const engines = o(o(d.quota).engines);
  const paused = Object.entries(engines).filter(([, e]) => Date.parse(String(o(e).pausedUntil || '')) > now).map(([id, e]) => `${id} (${o(e).reason})`);
  if (paused.length) {
    facts.push(`محركات متوقفة مؤقتاً: ${paused.join('، ')}`);
    push({ area: 'reliability', priority: paused.length >= 2 ? 'medium' : 'low', text: `${paused.length} محرك ذكاء اصطناعي متوقف (رصيد/باقة) — الاعتماد على النفس مهم اليوم` });
  }

  // School
  const rel = o(o(d.school).reliance);
  const relScore = n(rel.score);
  if (relScore !== undefined) {
    facts.push(`مدرسة شاهين: يرد وحده على ${relScore}% من أسئلة الامتحان (${n(rel.covered) ?? 0}/${n(rel.total) ?? 0}).`);
    if (relScore < 70) push({ area: 'reliability', priority: relScore < 50 ? 'high' : 'medium', text: `الاعتماد على النفس ${relScore}% فقط` });
    const pending = (Array.isArray(o(d.school).pending) ? o(d.school).pending as unknown[] : []).map((p) => String(o(p).q || '')).filter(Boolean);
    if (pending.length) facts.push(`أسئلة لم يذاكرها بعد: ${pending.slice(0, 4).join(' | ')}`);
  }

  // Source scout
  const sources = Array.isArray(o(d.sources).sources) ? o(d.sources).sources as unknown[] : [];
  if (o(d.sources).updatedAt && Date.parse(String(o(d.sources).updatedAt)) > 0) {
    const by = (st: string) => sources.filter((s) => o(s).status === st).length;
    facts.push(`كشّاف المصادر: ${by('active')} متجر نشط، ${by('candidate')} ينتظر، ${by('rejected')} مرفوض.`);
    if (!by('active') && sources.length >= 10) push({ area: 'store', priority: 'medium', text: 'لم يُقبل أي متجر عطور جديد بعد رغم فحص متاجر كثيرة',
      decision: { title: 'تحسين قبول المتاجر الجديدة في كشّاف المصادر', detail: 'راجع أسباب الرفض في src/data/live/import-sources.json (حماية، بلا خريطة موقع، صفحات غير مقروءة) وطوّر القارئ الذاتي أو طرق التصفح للمنصات الشائعة.', area: 'store', priority: 'medium', kind: 'task' } });
  }

  // Store review
  const sum = o(o(d.review).summary);
  if (n(sum.total) !== undefined) {
    facts.push(`المتجر: ${sum.total} منتج — ${n(sum.ok) ?? 0} سليم، ${n(sum.warn) ?? 0} بملاحظات، ${n(sum.hidden) ?? 0} مخفي، ${n(sum.brokenImages) ?? 0} صورة لا تفتح.`);
    const age = hoursSince(o(d.review).updatedAt, now);
    if (age !== undefined && age > 8) push({ area: 'store', priority: 'medium', text: `مستورد شاهين لم يعمل منذ ${Math.round(age)} ساعة`, decision: { title: 'تشغيل مستورد شاهين', detail: 'المراجعة قديمة؛ تشغيل المستورد الآن.', area: 'store', priority: 'medium', kind: 'auto', action: { type: 'rerun', workflow: 'shaheen-import.yml' } } });
    if ((n(sum.warn) ?? 0) > (n(sum.total) ?? 0) * 0.4) push({ area: 'store', priority: 'medium', text: `${sum.warn} منتج عليها ملاحظات من مراجع الصفحات` });
  }

  // SEO
  const audit = o(o(d.seo).audit);
  if (n(audit.score) !== undefined) {
    const sev = o(audit.bySeverity);
    facts.push(`الظهور في البحث: تقييم ${audit.score}/100 — ${n(sev.critical) ?? 0} حرجة، ${n(sev.major) ?? 0} كبيرة.`);
    const top = (Array.isArray(audit.findings) ? audit.findings as unknown[] : []).map(o).filter((f) => f.severity === 'critical' || f.severity === 'major').slice(0, 3);
    if ((n(audit.score) ?? 100) < 60 && top.length) push({ area: 'content', priority: 'high', text: `تقييم SEO ${audit.score}/100: ${top.map((f) => f.title).join('، ')}`,
      decision: { title: 'إصلاح أهم ملاحظات الظهور في البحث', detail: top.map((f) => `- ${f.title} (${f.page || '/'}): ${f.fix || f.detail || ''}`).join('\n'), area: 'content', priority: 'high', kind: 'task' } });
  }

  // News
  const newsAge = hoursSince(o(d.news).updatedAt, now);
  if (newsAge !== undefined) {
    facts.push(`نشرة الأخبار: آخر تحديث منذ ${Math.round(newsAge)} ساعة (${Array.isArray(o(d.news).items) ? (o(d.news).items as unknown[]).length : 0} خبر).`);
    if (newsAge > 30) push({ area: 'content', priority: 'medium', text: 'نشرة الأخبار متأخرة', decision: { title: 'تشغيل نشرة الأخبار', detail: 'آخر تحديث أقدم من 30 ساعة.', area: 'content', priority: 'medium', kind: 'auto', action: { type: 'rerun', workflow: 'shaheen-news.yml' } } });
  }

  // Skills / intake / background agent
  const sites = o(o(d.skills).sites);
  if (Object.keys(sites).length) facts.push(`مهارات القراءة الذاتية: ${Object.keys(sites).length} متجر.`);
  const checks = o(o(d.intake).checks);
  const failing = Object.entries(checks).filter(([k, v]) => k !== 'at' && v === 'failure').map(([k]) => k);
  if (failing.length) push({ area: 'reliability', priority: 'high', text: `فحوص فاشلة في آخر تحديث للموقع: ${failing.join('، ')}`,
    decision: { title: 'إصلاح الفحوص الفاشلة في آخر تحديث', detail: `الفحوص الفاشلة: ${failing.join('، ')} (src/data/live/aistudio-intake.json).`, area: 'reliability', priority: 'high', kind: 'task' } });
  const manusScore = n(o(d.manus).score);
  if (manusScore !== undefined) facts.push(`تدقيق التصميم واللغات (الوكيل الخلفي): ${manusScore}/100.`);
  // «جولة الزائر» — this morning's shopping journey on a phone; a broken cart or checkout is urgent.
  const tour = o(o(d.missions).tour);
  if ((hoursSince(tour.at, now) ?? 99) < 30) {
    const journey = (Array.isArray(tour.journey) ? tour.journey as unknown[] : []).map(o);
    const failed = journey.filter((s) => s.ok === false);
    facts.push(`جولة الزائر الصبح (موبايل): ${n(tour.score) ?? '—'}/100 — ${journey.length - failed.length}/${journey.length} خطوة سليمة. ${String(tour.summaryAr || '')}`.trim());
    for (const s of failed) {
      const urgent = s.step === 'cart' || s.step === 'checkout';
      push({ area: s.step === 'shaheen' ? 'ai-tools' : 'experience', priority: urgent ? 'high' : 'medium', text: `جولة الزائر: خطوة «${String(s.step)}» واقعة — ${String(s.noteAr || '')}`,
        decision: { title: `إصلاح خطوة «${String(s.step)}» في رحلة الشراء`, detail: `الوكيل الخلفي جرّب الموقع الحي من الموبايل الصبح: ${String(s.noteAr || '')} (src/data/live/manus-missions.json → tour).`, area: 'experience', priority: urgent ? 'high' : 'medium', kind: 'task' } });
    }
  }
  // «المستشار الميداني» — his proposals from this morning are on the agenda (the secretary can take them too).
  if ((hoursSince(tour.at, now) ?? 99) < 8) {
    const proposals = (Array.isArray(o(tour.advisor).proposals) ? o(tour.advisor).proposals as unknown[] : []).map(o);
    for (const p of proposals.slice(0, 5)) {
      const title = String(p.title || '').slice(0, 120);
      if (title.length < 4) continue;
      const area = AREAS.includes(p.area as Area) ? p.area as Area : 'experience';
      const priority = PRIOS.includes(p.priority as Priority) ? p.priority as Priority : 'medium';
      const action = checkAction({ type: 'rerun', workflow: p.rerun });
      push({ area, priority, text: `المستشار الميداني (جرّب الموقع الصبح) يقترح: ${title}`,
        decision: { title, detail: `${String(p.detail || '').slice(0, 1200)} (اقتراح المستشار الميداني من تجربة الموقع الحي — src/data/live/manus-missions.json → tour.advisor).`, area, priority, kind: action ? 'auto' : 'task', ...(action ? { action } : {}) } });
    }
  }
  // «المراجع الخارجي» — council tasks closed as done but still broken on the live site go back on the agenda.
  const verify = o(o(d.missions).verify);
  if ((hoursSince(verify.at, now) ?? 999) < 96) {
    const checks = (Array.isArray(verify.checks) ? verify.checks as unknown[] : []).map(o);
    const notFixed = checks.filter((c) => c.verdict === 'not_fixed');
    facts.push(`المراجع الخارجي راجع ${checks.length} مهمة مقفولة: ${checks.filter((c) => c.verdict === 'fixed').length} متصلحة فعلاً، ${notFixed.length} لسه.`);
    for (const c of notFixed) push({ area: 'reliability', priority: 'high', text: `مهمة اتقفلت ولسه مش متصلحة: ${String(c.title)}`,
      decision: { title: `إعادة فتح: ${String(c.title)}`, detail: `المراجع الخارجي فحص الموقع الحي ولقاها لسه: ${String(c.evidenceAr || '')}${c.url ? ` (المهمة القديمة: ${String(c.url)})` : ''}.`, area: 'reliability', priority: 'high', kind: 'task' } });
  }

  // «وكيل اللغات» — the language specialist under Shaheen (digits follow the site language, packs measured)
  const langReport = o(d.languages);
  const langScore = n(langReport.score);
  if (langScore !== undefined) {
    const listing = (v: unknown, max = 6): string[] => (Array.isArray(v) ? v as unknown[] : []).map((h) => `${String(o(h).file || '')}:${n(o(h).line) ?? '?'}`).filter((s) => s.length > 1).slice(0, max);
    const publicInputs = listing(langReport.publicNumberInputs, 8);
    const publicCount = (Array.isArray(langReport.publicNumberInputs) ? langReport.publicNumberInputs as unknown[] : []).length;
    const bareCount = (Array.isArray(langReport.bareLocaleFormatting) ? langReport.bareLocaleFormatting as unknown[] : []).length;
    const clampCount = (Array.isArray(langReport.languageClamps) ? langReport.languageClamps as unknown[] : []).length;
    const incomplete = (Array.isArray(langReport.incompletePacks) ? langReport.incompletePacks as unknown[] : []).map(o);
    const coverage = n(langReport.translationCoverage);
    facts.push(`اللغات: ${n(langReport.languageCount) ?? '—'} لغة (${n(langReport.fullyCovered) ?? '—'} مكتملة الحزم${coverage !== undefined ? `، والمترجم فعلاً ${coverage}% من النصوص — مش مكتملة طول ما هي أقل من 100%` : ''})، نتيجة وكيل اللغات ${langScore}/100 — حقول أرقام الزوار بلغة المتصفح: ${publicCount}، تنسيق بلا لغة: ${bareCount}، تقليل عربي/إنجليزي: ${clampCount}.`);
    if (publicCount > 0) {
      push({ area: 'experience', priority: 'high', text: `حقول أرقام في واجهات الزوار تُظهر أرقام لغة متصفح الزائر لا لغة الموقع (${publicCount}): ${publicInputs.join('، ')}`,
        decision: { title: 'توحيد أرقام حقول الزوار على لغة الموقع', detail: `وكيل اللغات وجد حقول <input type="number"> تتبع أرقام نظام الزائر (مثل ظهور ٦٥٠ على صفحة ألمانية). حوّلها إلى LocalizedNumberInput مع src/لغات/numerals.ts في: ${publicInputs.join('، ')} (src/data/live/shaheen-languages.json).`, area: 'experience', priority: 'high', kind: 'task' } });
    }
    if (incomplete.length) {
      const names = incomplete.map((p) => `${String(p.lang)} (متجر ${String(p.storeCore)}، بنر ${String(p.banner)})`).join('، ');
      push({ area: 'experience', priority: 'medium', text: `حزم لغات غير مكتملة (احتياطي إنجليزي): ${names}`,
        decision: { title: 'استكمال حزم اللغات الناقصة', detail: `لغات ينقصها مترجمات حزم المتجر/البنر: ${names}. أضف النصوص الناقصة في src/لغات (storeL10nExt/bannerL10nData) مع الحفاظ على الاحتياطي الإنجليزي.`, area: 'experience', priority: 'medium', kind: 'task' } });
    }
    if (clampCount > 0) push({ area: 'experience', priority: 'medium', text: `تقليل صارم للغة إلى عربي/إنجليزي في ${clampCount} موضع (راجع تقرير وكيل اللغات)` });
    if (bareCount > 0 && publicCount === 0) push({ area: 'experience', priority: 'low', text: `تنسيق أرقام/تواريخ بلا لغة صريحة في ${bareCount} موضع — الأرقام المعروضة قد تتبع لغة متصفح الزائر` });

    // «المترجم الذكي» + the link with the design department
    const tr = o(langReport.translation);
    if (n(tr.remaining) !== undefined) {
      const run = o(tr.run);
      facts.push(`المترجم الذكي: ${n(tr.remaining)} نص × لغة لسه بالإنجليزي، والذكاء الاصطناعي غطّى ${n(tr.covered) ?? 0} — آخر دورة ترجمت ${n(run.translated) ?? 0} ورفضت ${n(run.rejected) ?? 0} (الحالة: ${String(tr.status || '—')}).`);
      if (tr.status === 'no_engine' || tr.status === 'engines_failed') {
        push({ area: 'experience', priority: 'medium', text: tr.status === 'no_engine' ? 'المترجم الذكي واقف: مفيش مفتاح ذكاء اصطناعي شغال — اللغات الناقصة بتظهر بالإنجليزي' : 'المترجم الذكي: المحركات مردتش على الترجمة في آخر دورة' });
      }
    }
    const design = o(langReport.design);
    const located = (Array.isArray(design.located) ? design.located as unknown[] : []).map(o);
    if (located.length) {
      const where = located.slice(0, 6).map((l) => `«${String(l.phrase)}» ${String(l.file)}:${n(l.line) ?? '?'}`).join('، ');
      push({ area: 'experience', priority: 'medium', text: `قسم التصميم شاف نصوص بالإنجليزي، ووكيل اللغات حدد مكانها: ${where}`,
        decision: { title: 'مراجعة النصوص الإنجليزي اللي لقاها قسم التصميم', detail: `تدقيق التصميم (manus-audit.json) شاف النصوص دي بالإنجليزي على الموقع، ووكيل اللغات لقاها في: ${where}. المترجم الذكي بيغطي اللغات الناقصة تلقائياً؛ لو النص ظاهر بالإنجليزي في العربي أو في لغة أساسية، صحّح القاموس في نفس السطر.`, area: 'experience', priority: 'medium', kind: 'task' } });
    }
  }

  // «الفحص الشامل قبل الاجتماع»: every robot checked itself two hours ago; broken ones are on the agenda,
  // and the help requests the secretary routed between the tools are reported (safe ones carry an action).
  const pre = d.precheck as PrecheckFile | undefined;
  if (pre && Array.isArray(pre.bots) && (hoursSince(pre.updatedAt, now) ?? 99) < 8) {
    facts.push(pre.summaryAr);
    for (const b of pre.bots) {
      const bot = botOf(b.id);
      if (!bot || (b.status !== 'fail' && b.status !== 'warn') || !b.problems.length) continue;
      facts.push(`${bot.nameAr}: ${b.problems.slice(0, 2).join('، ')}${b.fixes[0] ? ` — الإصلاح المقترح: ${b.fixes[0]}` : ''}`);
      const late = b.problems.every((p) => /متأخر/.test(p));
      if (b.status === 'fail' && !late) {
        push({ area: deptArea(bot.dept), priority: 'high', text: `عطل في ${bot.nameAr}: ${b.problems.join('، ')}`,
          decision: { title: `إصلاح عطل: ${bot.nameAr}`, detail: `الفحص الشامل قبل الاجتماع:\n${b.problems.map((p) => `- ${p}`).join('\n')}${b.fixes.length ? `\nالإصلاح المقترح:\n${b.fixes.map((x) => `- ${x}`).join('\n')}` : ''}${b.lastRun?.url ? `\nسجل آخر تشغيل: ${b.lastRun.url}` : ''}`, area: deptArea(bot.dept), priority: 'high', kind: 'task' } });
      }
    }
    const legal = [...new Set(pre.bots.flatMap((b) => b.legal || []))];
    if (legal.length) facts.push(`قرارات المدير القانوني السارية (ملزمة — ممنوع تجاوزها): ${legal.join(' | ')}`);
    const ideas = pre.bots.filter((b) => b.ideas.length).map((b) => `${botOf(b.id)?.nameAr}: ${b.ideas[0]}`);
    if (ideas.length) facts.push(`أفكار تطوير من الأدوات: ${ideas.slice(0, 6).join(' | ')}`);
    for (const h of pre.handoffs || []) {
      facts.push(`تعاون: ${botOf(h.from)?.nameAr} ← ${botOf(h.to)?.nameAr}: ${h.textAr}`);
      if (h.action?.type === 'rerun' && !signals.some((x) => JSON.stringify(x.decision?.action) === JSON.stringify(h.action))) push({ area: deptArea(botOf(h.to)?.dept), priority: 'medium', text: h.textAr,
        decision: { title: `تشغيل ${botOf(h.to)?.nameAr}`, detail: h.textAr, area: deptArea(botOf(h.to)?.dept), priority: 'medium', kind: 'auto', action: h.action } });
    }
  }

  if (openTasks.length) facts.push(`مهام تطوير مفتوحة: ${openTasks.length} — ${openTasks.slice(0, 5).map((t) => t.title).join(' | ')}`);
  return { at: new Date(now).toISOString(), facts, signals };
}

const deptArea = (dept: string | undefined): Area => (dept === 'store' ? 'store' : dept === 'content' ? 'content' : dept === 'experience' ? 'experience' : dept === 'leadership' ? 'ai-tools' : 'reliability');

// ── 2. Opinions and minutes ────────────────────────────────────────────────────────────────────────────────
export const SEAT_SYSTEM = (seat: Seat) => `أنت «${seat.titleAr}» في الاجتماع اليومي لتطوير منصة «صمم عطرك مع شام» (موقع عطور عربي على GitHub Pages: متجر عطور، حاسبات تركيب، الخبير شاهين، مجتمع، أخبار).
تخصصك: ${seat.brief}.
اقرأ تقرير حالة الموقع الحقيقي، ثم اكتب رأيك بالعربية في 120–220 كلمة: ملاحظتان أو ثلاث من التقرير، ثم 2–4 اقتراحات تطوير عملية في تخصصك مرتبة بالأهمية، لكل اقتراح سطر «لماذا» من الأرقام.
لا تخترع أرقاماً غير موجودة في التقرير، ولا تقترح ما يخالف: التسعير (سعر المنتج + 50% + الشحن)، عدم ظهور أسماء شركات الذكاء الاصطناعي للزوار، عدم وضع مفاتيح في المستودع، وقرارات «المدير القانوني» (ملزمة: لا تقترح تجاوزها أو الالتفاف عليها).`;

export function seatPrompt(b: Briefing, previous?: Meeting) {
  return `تقرير حالة الموقع (${b.at}):\n${b.facts.map((f) => `- ${f}`).join('\n')}\n\nإشارات مرصودة آلياً:\n${b.signals.map((s) => `- [${s.priority}] ${s.text}`).join('\n') || '- لا شيء'}\n${previous ? `\nقرارات اجتماع ${previous.date}:\n${previous.decisions.map((d) => `- ${d.title} (${d.status})`).join('\n')}` : ''}`;
}

export const CHAIR_SYSTEM = `أنت «الخبير شاهين»، مدير كل أدوات الذكاء الاصطناعي في منصة «صمم عطرك مع شام» ورئيس اجتماع التطوير اليومي.
اقرأ تقرير الحالة وآراء الخبراء، ثم اكتب محضر الاجتماع: ملخص قصير، وقرارات مرتبة بالأهمية (من 3 إلى 7)، وهدف تطوير لكل أداة ذكاء اصطناعي تحتاج تحسيناً في تخصصها.
أنواع القرارات:
- "auto": تُنفذ فوراً، ومسموح فقط بهذه الإجراءات: {"type":"rerun","workflow":"shaheen-import.yml|shaheen-discover.yml|shaheen-news.yml|shaheen-seo.yml"} أو {"type":"study","question":"سؤال عطور عام يذاكره شاهين"} أو {"type":"scout-seed","domain":"نطاق متجر عطور"}.
- "task": مهمة تطوير برمجية لوكيل البرمجة (عنوان واضح وتفاصيل قابلة للتنفيذ: ماذا ولماذا وأين). needsApproval=true للتغييرات الكبيرة أو التي تمس الأسعار أو الدفع أو التصميم العام أو حذف شيء.
قرارات «المدير القانوني» في التقرير ملزمة: لا تتخذ ولا تقترح أي قرار يتجاوزها أو يلتف عليها (مثل تشغيل نقل المنتجات بدون إذن المورد). لا تكرر مهمة موجودة في «مهام مفتوحة». لا تذكر أسماء شركات أو نماذج ذكاء اصطناعي في أهداف الأدوات. أعد JSON فقط.`;

export function chairPrompt(b: Briefing, opinions: SeatOpinion[], openTasks: Task[], delegations: Delegation[] = []) {
  const toolIds = AI_TOOLS.map((t) => `${t.id} (${t.nameAr})`).join('، ');
  const deputy = delegations.length
    ? `\n\nما فعله سكرتيرك («مشرف شاهين») بالنيابة عنك منذ آخر اجتماع لك — راجعه، وصحح أي قرار في محضرك:\n${delegations.map((x) => `- ${x.date} (${x.reasons.join('، ')}): ${x.decisions.join(' | ') || 'لا قرارات'}`).join('\n')}`
    : '';
  return `${seatPrompt(b)}${deputy}\n\nآراء الخبراء:\n${opinions.filter((x) => x.ok).map((x) => `### ${seatTitle(x.seat)}\n${x.text.slice(0, 2500)}`).join('\n\n')}\n\nمهام مفتوحة (لا تكررها):\n${openTasks.map((t) => `- ${t.title}`).join('\n') || '- لا شيء'}\n\nالأدوات: ${toolIds}\n
أعد بالشكل:
{"summary":"جملتان","decisions":[{"title":"…","detail":"…","area":"ai-tools|store|content|experience|reliability","priority":"high|medium|low","kind":"auto|task","action":{…},"tool":"<id اختياري>","needsApproval":false}],"toolGoals":{"<id>":"هدف تطوير واحد محدد لهذه الأداة في تخصصها"}}`;
}

const VENDOR = /gemini|gpt|openai|chatgpt|claude|anthropic|deepseek|openrouter|perplexity|manus|llama|mistral|qwen|grok|جيميني|شات ?جي ?بي ?تي|كلود|ديب ?سيك/i;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+\n/g, '\n').trim().slice(0, max) : '');
const AREAS: Area[] = ['ai-tools', 'store', 'content', 'experience', 'reliability'];
const PRIOS: Priority[] = ['high', 'medium', 'low'];

/** An action from the fixed list only (anything else turns the decision into a task). */
export function checkAction(a: unknown): Action | undefined {
  const x = o(a);
  if (x.type === 'rerun' && RERUNNABLE.includes(x.workflow as Rerunnable)) return { type: 'rerun', workflow: x.workflow as Rerunnable };
  if (x.type === 'study') { const q = clean(x.question, 160); if (q.length >= 8 && /[\u0600-\u06FFa-z]/i.test(q) && !/سعر|أسعار|عرض|خصم|اليوم|الآن|price|offer|today/i.test(q)) return { type: 'study', question: q }; }
  if (x.type === 'scout-seed') { const d = clean(x.domain, 80).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return { type: 'scout-seed', domain: d }; }
  return undefined;
}

let seq = 0;
const decisionId = (date: string, title: string) => `${date}-${(++seq).toString(36)}-${title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 24)}`;

/** The chair's JSON → checked minutes (unknown tools, vendor names, links and empty items are dropped). */
export function parseMinutes(reply: unknown, date: string): Pick<Meeting, 'summaryAr' | 'decisions' | 'toolGoals'> | null {
  const r = o(reply);
  const summaryAr = clean(r.summary, 600);
  const raw = Array.isArray(r.decisions) ? r.decisions : [];
  const decisions: Decision[] = [];
  for (const item of raw.slice(0, 8)) {
    const x = o(item);
    const title = clean(x.title, 120); const detail = clean(x.detail, 1500);
    if (title.length < 4) continue;
    const action = x.kind === 'auto' ? checkAction(x.action) : undefined;
    const tool = AI_TOOLS.some((t) => t.id === x.tool) ? x.tool as AiToolId : undefined;
    decisions.push({
      id: decisionId(date, title), title, detail, tool,
      area: AREAS.includes(x.area as Area) ? x.area as Area : 'reliability',
      priority: PRIOS.includes(x.priority as Priority) ? x.priority as Priority : 'medium',
      kind: action ? 'auto' : 'task', ...(action ? { action } : {}),
      needsApproval: !action && Boolean(x.needsApproval),
      status: 'queued',
    });
  }
  const toolGoals: Partial<Record<AiToolId, string>> = {};
  for (const [id, goal] of Object.entries(o(r.toolGoals))) {
    const text = clean(goal, 300);
    if (AI_TOOLS.some((t) => t.id === id) && text.length >= 10 && !VENDOR.test(text) && !/https?:\/\//.test(text)) toolGoals[id as AiToolId] = text;
  }
  if (!summaryAr && !decisions.length) return null;
  return { summaryAr: summaryAr || 'محضر بلا ملخص.', decisions, toolGoals };
}

/** Minutes without any AI: the briefing's signals become decisions (most urgent first). */
export function selfMinutes(b: Briefing, date: string, deputyReasons: string[] = []): Pick<Meeting, 'summaryAr' | 'decisions' | 'toolGoals'> {
  const order = { high: 0, medium: 1, low: 2 } as const;
  const decisions = b.signals.filter((s) => s.decision).sort((a, c) => order[a.priority] - order[c.priority]).slice(0, 6)
    .map((s) => ({ ...s.decision!, id: decisionId(date, s.decision!.title), status: 'queued' as const, needsApproval: Boolean(s.decision!.needsApproval), by: 'secretary' as const }));
  const urgent = b.signals.filter((s) => s.priority === 'high').length;
  return {
    summaryAr: `${deputyReasons.length ? `السكرتير (مشرف شاهين) أدار الاجتماع بالنيابة عن شاهين (${deputyReasons.join('، ')})، من تقارير الأدوات` : 'اجتماع بدون ذكاء اصطناعي (من تقارير الأدوات)'}: ${b.signals.length} ملاحظة، منها ${urgent} عاجلة. ${decisions.length ? `القرارات: ${decisions.map((d) => d.title).join('، ')}.` : 'لا قرارات جديدة اليوم.'}`,
    decisions,
    // A weak tool's own fix list becomes its development goal (the supervisor passes it to the tool's review).
    toolGoals: Object.fromEntries(decisions.filter((d) => d.tool).map((d) => [d.tool, d.detail.slice(0, 400)])),
  };
}

/**
 * Under pressure with Shaheen still chairing: the secretary takes the routine — the safe actions the reports
 * call for (reruns, help requests) — so Shaheen's discussion is only about what needs him.
 */
export function secretaryRoutine(b: Briefing, date: string, taken: Decision[]): Decision[] {
  return b.signals.filter((s) => s.decision?.kind === 'auto' && s.decision.action)
    .filter((s) => !taken.some((d) => d.action && JSON.stringify(d.action) === JSON.stringify(s.decision!.action)))
    .map((s) => ({ ...s.decision!, id: decisionId(date, s.decision!.title), status: 'queued' as const, by: 'secretary' as const, needsApproval: false }));
}

/** Records what the secretary did on Shaheen's behalf; marks earlier records reviewed when Shaheen chairs. */
export function recordDelegation(file: CouncilFile, meeting: Meeting): void {
  const list = file.delegations || [];
  if (meeting.chair === 'shaheen') { for (const x of list) if (!x.reviewedAt) x.reviewedAt = meeting.at; }
  const mine = meeting.decisions.filter((d) => d.by === 'secretary').map((d) => `${d.title} (${d.note || d.status})`);
  if (meeting.chair === 'secretary' || mine.length) list.unshift({ date: meeting.date, at: meeting.at, reasons: meeting.deputyReasons || [], decisions: mine, ...(meeting.chair === 'shaheen' ? { reviewedAt: meeting.at } : {}) });
  file.delegations = list.slice(0, 30);
}
export const unreviewed = (file: CouncilFile) => (file.delegations || []).filter((x) => !x.reviewedAt);

// ── 3. Applying decisions ───────────────────────────────────────────────────────────────────────────────────
/** Same task already open (or done in the last 14 days)? Titles are compared by meaning. */
export function duplicateOf(tasks: Task[], title: string, now: number): Task | undefined {
  return tasks.find((t) => (t.status === 'open' || (t.closedAt && now - Date.parse(t.closedAt) < 14 * 86_400_000)) && (similarity(t.title, title) >= 0.6 || t.title === title));
}

export interface Applied { reruns: Rerunnable[]; newTasks: Task[] }

/**
 * Applies a meeting to the council file: safe actions are recorded (reruns returned for the workflow, at most
 * 2 a day), questions/stores queued for the school and the scout, goals kept per tool, tasks added once
 * (at most `maxNewTasks` a day, most urgent first).
 */
export function applyMeeting(file: CouncilFile, meeting: Meeting, now: number, maxNewTasks = 3): Applied {
  const reruns: Rerunnable[] = [];
  const newTasks: Task[] = [];
  const order = { high: 0, medium: 1, low: 2 } as const;
  for (const d of [...meeting.decisions].sort((a, b) => order[a.priority] - order[b.priority])) {
    if (d.kind === 'auto' && d.action) {
      const a = d.action;
      if (a.type === 'rerun') {
        if (reruns.length < 2 && !reruns.includes(a.workflow)) { reruns.push(a.workflow); d.status = 'applied'; d.note = 'شُغّلت الأداة'; } else { d.status = 'skipped'; d.note = 'الحد اليومي'; }
      } else if (a.type === 'study') {
        if (!file.study.some((s) => similarity(s.q, a.question) >= 0.8)) file.study.push({ q: a.question, at: meeting.at });
        d.status = 'applied'; d.note = 'أضيف لمدرسة شاهين';
      } else if (a.type === 'scout-seed') {
        if (!file.seeds.some((s) => s.domain === a.domain)) file.seeds.push({ domain: a.domain, at: meeting.at });
        d.status = 'applied'; d.note = 'أضيف لكشّاف المصادر';
      }
      continue;
    }
    const dup = duplicateOf(file.tasks, d.title, now);
    if (dup) { d.status = 'skipped'; d.note = `موجودة كمهمة${dup.issue ? ` #${dup.issue}` : ''}`; continue; }
    if (newTasks.length >= maxNewTasks) { d.status = 'skipped'; d.note = 'الحد اليومي للمهام — يُعاد طرحها غداً'; continue; }
    const task: Task = { id: d.id, title: d.title, detail: d.detail, area: d.area, priority: d.priority, needsApproval: Boolean(d.needsApproval), createdAt: meeting.at, meeting: meeting.date, status: 'open' };
    file.tasks.push(task); newTasks.push(task);
    d.status = 'queued'; d.note = d.needsApproval ? 'مهمة تنتظر موافقتك' : 'مهمة لوكيل البرمجة';
  }
  for (const [id, text] of Object.entries(meeting.toolGoals)) if (text) file.toolGoals[id as AiToolId] = { text, since: meeting.at };
  // Bounded memory: 30 meetings, tasks closed more than 60 days ago dropped, recent study/seed requests only.
  file.meetings = [meeting, ...file.meetings.filter((m) => m.date !== meeting.date)].slice(0, 30);
  file.tasks = file.tasks.filter((t) => t.status === 'open' || !t.closedAt || now - Date.parse(t.closedAt) < 60 * 86_400_000).slice(-200);
  file.study = file.study.slice(-30);
  file.seeds = file.seeds.slice(-30);
  file.updatedAt = meeting.at;
  return { reruns, newTasks };
}

/** The issue text a coding agent reads (Arabic for the merchant, with the context it needs). */
export function issueBody(t: Task) {
  return `${t.detail}\n\n---\n- المجال: ${t.area} · الأولوية: ${t.priority}${t.needsApproval ? ' · **تحتاج موافقة التاجر قبل التنفيذ**' : ''}\n- من اجتماع شاهين اليومي بتاريخ ${t.meeting} (src/data/live/shaheen-council.json)\n- للتنفيذ: افتح شات وكيل البرمجة واكتب «نفذ مهام شاهين». التعليمات في AGENTS.md.\n\n<!-- shaheen-task:${t.id} -->`;
}

/** Issue states → task states (closed as completed = done, closed otherwise = dropped). */
export function syncTasks(tasks: Task[], issues: { number: number; state: string; state_reason?: string | null; closed_at?: string | null; html_url?: string; body?: string | null }[]) {
  let changed = 0;
  for (const t of tasks) {
    const issue = issues.find((i) => i.number === t.issue || (i.body || '').includes(`<!-- shaheen-task:${t.id} -->`));
    if (!issue) continue;
    if (!t.issue) { t.issue = issue.number; t.url = issue.html_url; changed++; }
    const status = issue.state === 'open' ? 'open' : issue.state_reason === 'not_planned' ? 'dropped' : 'done';
    if (status !== t.status) { t.status = status; t.closedAt = issue.closed_at || undefined; changed++; }
  }
  return changed;
}

/** For «مدرسة شاهين» and «كشّاف المصادر»: what the meetings asked of them recently. */
/** The latest minutes for the other bots (supervisor, school, scout); undefined before the first meeting. */
export function readCouncil(url: URL = new URL('../../src/data/live/shaheen-council.json', import.meta.url)): CouncilFile | undefined {
  try { const d: unknown = existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : undefined; return isCouncilFile(d) ? d : undefined; } catch { return undefined; }
}
export const councilStudy = (file: CouncilFile | undefined, now: number) => (file?.study || []).filter((s) => now - Date.parse(s.at) < 14 * 86_400_000).map((s) => s.q);
export const councilSeeds = (file: CouncilFile | undefined, now: number) => (file?.seeds || []).filter((s) => now - Date.parse(s.at) < 30 * 86_400_000).map((s) => s.domain);
export const councilGoal = (file: CouncilFile | undefined, tool: string) => file?.toolGoals?.[tool as AiToolId]?.text;
