/**
 * «مناورة التخصصات» — the field maneuver (every 6 hours, .github/workflows/shaheen-maneuver.yml).
 *
 *   1. the phone browser opens every public section of the live site (GitHub Pages) and measures what a visitor sees:
 *      program errors, failed requests, an empty page, raw program text, a page wider than the phone, broken photos,
 *      slowness — and the improvements a section is missing (photo descriptions, button names, a heading);
 *   2. the conversation drills run against Shaheen's own brain offline (src/utils/maneuverDrills.ts), and a few of
 *      them, rotating, against the live chat — each graded by what a good answer must and must never do;
 *   3. while the AI platforms work (the owner's switch is not «يعتمد على نفسه»), one reviewer request proposes up to
 *      five improvements from what was seen; when they don't, the rules' ideas stand alone;
 *   4. everything → src/data/live/shaheen-maneuver.json. «دولة المنصة» (scripts/state/run.mts) reads it, decides the
 *      sector and robot of each finding and turns the serious errors into tasks.
 * Each section is examined by its own specialist (SITE_SECTIONS consultants). Nothing is faked: a pass that could
 * not run says so and the findings it saw before are kept as they were.
 * Env: MANEUVER_BROWSER / MANEUVER_LIVE / MANEUVER_AI = 'false' to skip a pass; PUPPETEER_PATH, CHROME_PATH.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SITE } from '../../src/seo/site';
import { mergeCatalog, type RawProduct } from '../../src/utils/storeCatalog';
import {
  CHAT_SECTION, MANEUVER_LIMITS, fieldSections, maneuverSummaryAr, mergeFindings, pageFindings, readManeuverReport, sectionHash, sectionStatus,
  sectionTitle, type FindingSource, type ManeuverFinding, type ManeuverReport, type SectionResult,
} from '../../src/utils/maneuver';
import { MANEUVER_DRILLS, gradeTurn, liveDrillsFor, runBrainDrills, type Drill } from '../../src/utils/maneuverDrills';
import { SITE_SECTIONS } from '../../src/utils/shaheenSpecialists';
import { openBrowser, probeSection } from './browser';
import { loadOwnerControls } from '../owner/load';

type Draft = Omit<ManeuverFinding, 'firstSeen' | 'lastSeen' | 'seen' | 'sectionAr' | 'examinerAr'>;
const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const REPORT = live('shaheen-maneuver.json');
const env = process.env;
const say = (s: string) => console.log(s);
const output = (k: string, v: string) => { if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const readJson = (url: URL): unknown => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : undefined; } catch { return undefined; } };

const started = Date.now();
const at = new Date().toISOString();
const previous = readManeuverReport(readJson(REPORT));
const products = mergeCatalog(((readJson(new URL('../../src/data/products.json', import.meta.url)) as { products?: RawProduct[] } | undefined)?.products) || [], readJson(live('store-catalog.json')) as never);
const drafts: Draft[] = [];
const ran = new Set<FindingSource>(['rules']);
const sections: SectionResult[] = [];

// ── 1. The phone browser on every public section ────────────────────────────────────────────────────────────
let browserNoteAr: string | undefined;
let pages = 0;
const pagesUrl = SITE.url.replace(/\/?$/, '/');
const productId = products.find((p) => p.inStock && /^\d+$/.test(String(p.id)))?.id ?? products.find((p) => /^\d+$/.test(String(p.id)))?.id;
if (env.MANEUVER_BROWSER !== 'false') {
  const { browser, noteAr } = await openBrowser();
  browserNoteAr = noteAr;
  if (browser) {
    ran.add('browser');
    try {
      for (const s of fieldSections()) {
        const hash = sectionHash(s.id, productId);
        if (!hash) { sections.push({ id: s.id, titleAr: s.titleAr, status: 'skipped', errors: 0, ideas: 0, noteAr: 'مفيش منتج منشور نفتح صفحته' }); continue; }
        const probe = await probeSection(browser, { section: s.id, url: `${pagesUrl}${hash}` });
        pages += 1;
        const found = pageFindings(probe);
        drafts.push(...found);
        sections.push({ id: s.id, titleAr: s.titleAr, status: sectionStatus(found), errors: found.filter((f) => f.kind === 'error').length, ideas: found.filter((f) => f.kind === 'idea').length, ...(probe.ok ? { loadMs: probe.loadMs } : {}) });
        say(`${s.titleAr}: ${found.length ? found.map((f) => `${f.kind === 'error' ? '❌' : '💡'} ${f.titleAr}`).join(' · ') : 'سليم ✅'}`);
      }
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
} else browserNoteAr = 'فحص الأقسام بالمتصفح متوقف في التشغيل ده';
if (browserNoteAr) say(browserNoteAr);
if (!ran.has('browser')) for (const s of fieldSections()) sections.push({ id: s.id, titleAr: s.titleAr, status: 'skipped', errors: 0, ideas: 0, ...(browserNoteAr ? { noteAr: browserNoteAr } : {}) });

// ── 2. The conversation drills: his own brain offline, then a few on the live chat ─────────────────────────────
const brain = runBrainDrills(products);
ran.add('brain');
drafts.push(...brain.findings);
say(`تدريبات المحادثة (مخ شاهين): ${MANEUVER_DRILLS.length} محادثة، ${brain.turns} رسالة، رد من نفسه على ${brain.answeredOwn} — ${brain.findings.length} ملاحظة`);

let liveRuns = 0;
if (env.MANEUVER_LIVE !== 'false') {
  const api = new URL('api/chat', SITE.engineUrl.replace(/\/?$/, '/')).href;
  const origin = new URL(SITE.url).origin;
  let reached = false;
  for (const drill of liveDrillsFor(new Date(), MANEUVER_LIMITS.liveDrills)) {
    const result = await liveDrill(api, origin, drill);
    if (result.reached) reached = true;
    if (result.stop) { say(`الشات الحي: ${result.stop}`); break; }
    liveRuns += 1;
    drafts.push(...result.findings);
    say(`الشات الحي «${drill.id}»: ${result.findings.length ? result.findings.map((f) => f.titleAr).join(' · ') : 'سليم ✅'}`);
  }
  if (reached) ran.add('chat-live');
}

async function liveDrill(api: string, origin: string, drill: Drill): Promise<{ findings: Draft[]; reached: boolean; stop?: string }> {
  const history: { role: 'user' | 'assistant'; text: string }[] = [];
  const findings: Draft[] = [];
  let previousReply: string | undefined;
  let reached = false;
  for (let index = 0; index < drill.turns.length; index++) {
    const t = drill.turns[index];
    const text = typeof t === 'string' ? t : t.say;
    let status = 0; let body: Record<string, unknown> = {}; let ms = 0;
    try {
      const t0 = Date.now();
      const res = await fetch(api, {
        method: 'POST', signal: AbortSignal.timeout(55_000),
        headers: { 'content-type': 'application/json', origin, 'user-agent': 'ShamManeuver/1.0 (+field drill)' },
        body: JSON.stringify({ message: text, language: drill.language, model: 'auto', conversationHistory: history.slice(-12) }),
      });
      ms = Date.now() - t0; status = res.status;
      body = await res.json().catch(() => ({})) as Record<string, unknown>;
    } catch (e) {
      return { findings, reached, stop: `مقدرتش أوصل للشات (${String(e).slice(0, 100)}) — التدريب الحي اتأجل` };
    }
    // Busy or rate-limited: not the visitor experience's fault this minute — try next run.
    if (status === 429 || status === 503) return { findings, reached, stop: `الشات مشغول (${status}) — الباقي في المرة الجاية` };
    reached = true;
    const reply = typeof body.reply === 'string' ? body.reply : '';
    if (status !== 200) {
      findings.push({ id: `${CHAT_SECTION.id}:${drill.id}:${index}:chat-http`, kind: 'error', code: 'chat-http', topic: drill.topic, section: CHAT_SECTION.id, titleAr: `الشات رجّع خطأ ${status}`, detailAr: `الزائر: «${text}»`, severity: 'high', sources: ['chat-live'] });
      break;
    }
    const relations = body.relations as { situation?: string } | undefined;
    const store = body.store as { sale?: boolean } | undefined;
    const route = relations?.situation ? `relations:${relations.situation}` : store?.sale ? 'sales' : body.memory === 'store' ? 'store' : typeof body.quick === 'string' ? `quick:${body.quick}` : undefined;
    findings.push(...gradeTurn({ drill, index, reply, route, previousReply, source: 'chat-live', offline: false }));
    if (ms > 30_000) findings.push({ id: `${CHAT_SECTION.id}:slow`, kind: 'error', code: 'slow', topic: drill.topic, section: CHAT_SECTION.id, titleAr: `شاهين اتأخر في الرد (${Math.round(ms / 1000)} ثانية)`, detailAr: `الزائر: «${text}»`, severity: 'medium', sources: ['chat-live'] });
    history.push({ role: 'user', text }, { role: 'assistant', text: reply || '…' });
    previousReply = reply || previousReply;
  }
  return { findings, reached };
}

// ── 3. Improvements from a reviewer (while the platforms work) ──────────────────────────────────────────────────
let aiUsed = false;
const controls = loadOwnerControls();
if (env.MANEUVER_AI !== 'false' && controls.aiPlatforms !== 'off') {
  try {
    const { makeAsk, quotaBook } = await import('../doctor/agent');
    const quota = quotaBook(live('ai-quota.json'));
    const ask = await makeAsk(env, { bot: 'maneuver', quota, maxWaitMs: 20_000 }).catch(() => undefined);
    if (ask) {
      const seen = drafts.slice(0, 40).map((d) => `- [${d.section}] ${d.kind === 'error' ? 'خطأ' : 'فكرة'}: ${d.titleAr}`).join('\n') || '- (مفيش أخطاء ظاهرة)';
      const ids = [...fieldSections().map((s) => s.id), CHAT_SECTION.id].join(', ');
      const system = 'You review an Arabic perfume-design website (store, calculators, guides, a chat expert named Shaheen) as a product and UX expert. Answer with strict JSON only.';
      const prompt = `هذه نتائج فحص ميداني للموقع على الموبايل:\n${seen}\n\nاقترح حتى 5 تحسينات ناقصة فعلاً (مش أخطاء موجودة فوق) تفيد الزائر. لكل تحسين: section من هذه المعرّفات فقط: ${ids}، وtitleAr جملة عربية قصيرة (أقل من 120 حرف)، وwhyAr سبب قصير. ممنوع اختراع خصومات أو تقييمات أو سياسات.\nالرد JSON فقط: {"ideas":[{"section":"…","titleAr":"…","whyAr":"…"}]}`;
      const raw = await ask(system, prompt);
      const json = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]) as { ideas?: { section?: string; titleAr?: string; whyAr?: string }[] };
      const allowed = new Set([...SITE_SECTIONS.map((s) => s.id), CHAT_SECTION.id]);
      for (const idea of (json.ideas || []).slice(0, 5)) {
        const section = String(idea.section || ''); const titleAr = String(idea.titleAr || '').trim().slice(0, 160);
        if (!allowed.has(section) || section === 'admin_panel' || !/[\u0621-\u064A]/.test(titleAr)) continue;
        const key = titleAr.replace(/[^\u0621-\u064Aa-z0-9]+/gi, '').slice(0, 24);
        drafts.push({ id: `${section}:ai-idea:${key}`, kind: 'idea', code: 'ai-idea', section, titleAr, ...(idea.whyAr ? { detailAr: String(idea.whyAr).slice(0, 300) } : {}), severity: 'low', sources: ['ai'] });
      }
      aiUsed = true;
      ran.add('ai');
    }
    quota.save();
  } catch (e) {
    say(`مراجع التحسينات ماردش (${String(e).slice(0, 120)}) — أفكار القواعد بس`);
  }
} else say('مراجع التحسينات: متوقف (الموقع معتمد على نفسه أو اتقفل في التشغيل ده) — أفكار القواعد بس');

// ── 4. The report ──────────────────────────────────────────────────────────────────────────────────────────────
const merged = mergeFindings(previous, drafts, ran, at);
const chatFindings = merged.findings.filter((f) => f.section === CHAT_SECTION.id);
sections.push({ id: CHAT_SECTION.id, titleAr: sectionTitle(CHAT_SECTION.id), status: sectionStatus(chatFindings), errors: chatFindings.filter((f) => f.kind === 'error').length, ideas: chatFindings.filter((f) => f.kind === 'idea').length });
const report: ManeuverReport = {
  updatedAt: at,
  run: { ms: Date.now() - started, browser: ran.has('browser'), ...(browserNoteAr ? { browserNoteAr } : {}), pages, drills: MANEUVER_DRILLS.length, live: liveRuns, ai: aiUsed },
  sections, findings: merged.findings, resolved: merged.resolved,
};
writeFileSync(REPORT, `${JSON.stringify(report, null, 1)}\n`);
const summary = maneuverSummaryAr(report);
say(summary);
if (env.GITHUB_STEP_SUMMARY) {
  const rows = report.findings.filter((f) => f.kind === 'error').slice(0, 40).map((f) => `| ${f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟠' : '🟡'} | ${f.sectionAr} | ${f.titleAr.replace(/\|/g, '/')} |`).join('\n');
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## مناورة التخصصات\n\n${summary}\n\n| | القسم | الخطأ |\n|---|---|---|\n${rows}\n`);
}
// Annotations on the run page: the summary, how each pass went, and the serious errors (GitHub shows at most 10 per type).
const esc = (x: string) => x.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
say(`::notice title=Maneuver::${esc(`${summary} المتصفح: ${report.run.browser ? `${pages} قسم` : browserNoteAr || 'متوقف'} — الشات الحي: ${liveRuns} محادثة`)}`);
for (const f of report.findings.filter((x) => x.kind === 'error' && x.severity === 'high').slice(0, 8)) say(`::warning title=${esc(f.sectionAr).replace(/[:,]/g, ' ')}::${esc(`${f.titleAr}${f.detailAr ? ` — ${f.detailAr}` : ''}`)}`);
output('publish', 'true');
