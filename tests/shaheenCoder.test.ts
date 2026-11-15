import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fixReply, needsRevision, profileQuestion, reviewReply, revisionRequest, thinkingHint, withPlan,
} from '../src/utils/thinkingCraft';
import {
  CODE_MAP_ROOTS, CODE_MAP_SKIP, CODE_MAP_SOURCE, codeMapEntry, formatHits, queryWords, readCodeMap, searchCodeMap, searchPaths, type CodeMap,
} from '../src/utils/codeMap';
import {
  codeSkeleton, displaySearches, fitHistory, LESSONS_MAX, LESSONS_PATH, lessonMarks, lessonsBrief, lessonsEdit, lookupFollowUp, mustFix,
  readLessons, repairRequest, reviewEdits, searchRequests, selfCheckNote, withLessonChange,
} from '../src/utils/shaheenCoder';
import { CODER_CASES, REVIEW_CASES, runShaheenEval, SEARCH_CASES, UNDERSTAND_CASES } from '../scripts/inspect/shaheen-eval';
import { displayReply, parseChanges, planChange } from '../src/utils/ownerFiles';
import bundledLessons from '../src/data/shaheen/lessons.json';

const root = fileURLToPath(new URL('..', import.meta.url));
let realMap: CodeMap | undefined;
/** The same map the build emits (vite.config.ts), from the code in this checkout. */
function codeMap(): CodeMap {
  if (realMap) return realMap;
  const files: CodeMap['files'] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const path = relative(root, full).split('\\').join('/');
      if (CODE_MAP_SKIP.test(`${path}/`) || CODE_MAP_SKIP.test(path)) continue;
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else if (CODE_MAP_SOURCE.test(name)) files.push(codeMapEntry(path, readFileSync(full, 'utf8')));
    }
  };
  for (const top of CODE_MAP_ROOTS) { try { walk(join(root, top)); } catch { /* a root that does not exist */ } }
  realMap = { v: 1, files };
  return realMap;
}

// ── «امتحان شاهين» ──────────────────────────────────────────────────────────────────────────────────────────
test('the fixed benchmark passes in full (understanding, review, code review, search)', () => {
  const report = runShaheenEval(codeMap());
  const failed = report.results.filter((r) => !r.ok);
  assert.deepEqual(failed, [], `failed: ${JSON.stringify(failed, null, 1)}`);
  assert.equal(report.total, UNDERSTAND_CASES.length + REVIEW_CASES.length + CODER_CASES.length + SEARCH_CASES.length);
  assert.equal(report.score, 100);
  assert.ok(report.total >= 44, 'cases are added, never removed');
});
test('without a code map the search cases are left out, not failed', () => {
  const report = runShaheenEval();
  assert.equal(report.total, UNDERSTAND_CASES.length + REVIEW_CASES.length + CODER_CASES.length);
  assert.ok(!report.results.some((r) => r.section === 'search'));
});

// ── Thinking craft ──────────────────────────────────────────────────────────────────────────────────────────
test('profileQuestion reads the kind, the questions, vagueness and the script', () => {
  assert.equal(profileQuestion('ايه أحسن عطر للشتا الشرقي ولا الخشبي؟').kind, 'compare');
  assert.equal(profileQuestion('مين رئيس فرنسا؟').kind, 'quick');
  assert.equal(profileQuestion('ساعدني').vague, true);
  assert.equal(profileQuestion('ساعدني', true).vague, false, 'an earlier conversation gives the context');
  assert.equal(profileQuestion('العالم كبير').kind, 'general');
  assert.equal(profileQuestion('Hello there, how are you today?').script, 'latin');
  assert.equal(profileQuestion('أ؟ ب؟ ج؟').questions, 3);
  assert.equal(profileQuestion('أ؟ ب؟').deep, true);
  // «وليه» and «بكود» still match after the conjunction / preposition; words that merely contain a stem do not.
  assert.equal(profileQuestion('وليه السما زرقا').kind, 'explain');
  assert.equal(profileQuestion('وبالكود ده بيطلع ايرور').kind, 'code');
});
test('thinkingHint adds the shape of the answer and the count of questions', () => {
  assert.match(thinkingHint(profileQuestion('إيه الفرق بين EDP و EDT؟ وأيهم أرخص؟')), /جدول[\s\S]*2 أسئلة/);
  assert.equal(thinkingHint(profileQuestion('العالم كبير')), '');
  assert.match(thinkingHint(profileQuestion('ساعدني')), /سؤال/);
});
test('fixReply closes an open code block; needsRevision only for revise notes', () => {
  assert.equal(fixReply('```js\nx'), '```js\nx\n```');
  assert.equal(fixReply('done'), 'done');
  assert.equal(needsRevision([{ id: 'open_fence', severity: 'fix', ar: '' }]), false);
  assert.equal(needsRevision(reviewReply('ازاي أعمل عطر؟', 'Some english '.repeat(30))), true);
  assert.deepEqual(reviewReply('سؤال', ''), [{ id: 'empty', severity: 'revise', ar: 'الرد فاضي.' }]);
});
test('the deep plan and the rewrite request carry what they must', () => {
  const planned = withPlan('السؤال', 'خطة');
  assert.ok(planned.startsWith('السؤال') && planned.includes('خطة') && /ما تنسخهاش/.test(planned));
  const req = revisionRequest('السؤال', 'المسودة', [{ id: 'cut', severity: 'revise', ar: 'الرد وقف' }]);
  assert.ok(req.includes('السؤال') && req.includes('المسودة') && req.includes('- الرد وقف'));
});

// ── The code map ───────────────────────────────────────────────────────────────────────────────────────────
test('codeMapEntry keeps the exports, the description and the named features', () => {
  const e = codeMapEntry('src/utils/x.ts', "import a from 'a';\n/** «حاسبة الشحن» — shipping per country. */\nexport function shipCost() {}\nexport const RATE = 1;\nexport default function Panel() {}\n// «زرار الدفع»\n");
  assert.equal(e.p, 'src/utils/x.ts');
  assert.ok(e.s.includes('shipCost') && e.s.includes('RATE') && e.s.includes('Panel'));
  assert.match(e.d || '', /حاسبة الشحن/);
  assert.ok((e.n || []).includes('حاسبة الشحن'));
});
test('search finds files by Arabic section names through English code words', () => {
  const map = codeMap();
  assert.ok(map.files.length > 500, 'the whole code is in the map');
  assert.ok(!map.files.some((f) => /^src\/data\//.test(f.p)), 'robot data stays out');
  const top = (q: string, n = 3) => searchCodeMap(map, q, n).map((h) => h.path);
  assert.ok(top('الفوتر').includes('src/components/Footer.tsx'));
  assert.ok(top('CosmeticsHub').includes('src/components/CosmeticsHub.tsx'));
  assert.deepEqual(searchCodeMap(map, 'zzqqxx'), []);
  assert.match(formatHits('الفوتر', searchCodeMap(map, 'الفوتر', 2)), /^🔎 «الفوتر»:\n- src\//);
  assert.match(formatHits('x', []), /مفيش ملفات مطابقة/);
});
test('the map from a deployment is checked; paths alone work as a fallback', () => {
  assert.equal(readCodeMap({ v: 2, files: [] }), undefined);
  assert.equal(readCodeMap(null), undefined);
  assert.deepEqual(readCodeMap({ v: 1, files: [{ p: 'a.ts', s: [] }, { bad: 1 }] })?.files.length, 1);
  assert.deepEqual(searchPaths(['src/components/Footer.tsx', 'src/data/x.json', 'README.md'], 'footer').map((h) => h.path), ['src/components/Footer.tsx']);
  assert.ok(queryWords('the الفوتر في الموقع').includes('فوتر'));
});

// ── Searching, reviewing and mending a change ─────────────────────────────────────────────────────────────
test('search marks are read (three at most) and shown as a short note', () => {
  const reply = 'هدوّر الأول: [[ابحث: زرار الحفظ]] و [[ابحث: Footer]] [[search: cart]] [[ابحث: زيادة]] [[ابحث: زرار الحفظ]]';
  assert.deepEqual(searchRequests(reply), ['زرار الحفظ', 'Footer', 'cart']);
  assert.equal(displaySearches('[[ابحث: Footer]]'), '🔎 «Footer»');
  assert.equal(displayReply('[[ابحث: Footer]] تمام'), '🔎 «Footer» تمام');
  assert.match(lookupFollowUp(['a.ts'], ['b.ts'], ['🔎 «x»: …']), /🔎 «x»[\s\S]*a\.ts[\s\S]*b\.ts[\s\S]*\[\[اقرأ/);
});
test('reviewEdits flags each known mistake and passes a clean change', () => {
  for (const c of CODER_CASES) {
    const ids = reviewEdits(c.edits, (p) => c.files[p]).map((f) => f.id);
    for (const id of c.expect) assert.ok(ids.includes(id), `${c.name}: expected ${id}, got ${ids}`);
    for (const id of c.absent || []) assert.ok(!ids.includes(id), `${c.name}: ${id} should not appear`);
  }
});
test('translations written the right way are not flagged as hard-coded text', () => {
  const file = "export const L = {\n  a: 1,\n};\n";
  const edits = [{ path: 'src/components/Box.tsx', search: '  a: 1,', replace: "  a: 1,\n  title: { ar: 'العنوان', en: 'Title', fr: 'Titre' },\n  hint: {\n    ar: 'تلميح',\n    en: 'Hint',\n  }," }];
  assert.deepEqual(reviewEdits(edits, () => file).map((f) => f.id), []);
});
test('brackets are counted outside strings, comments and template literals', () => {
  assert.equal(codeSkeleton("const a = '{'; // }\nconst b = `${x} {`;"), "const a = ''; \nconst b = ``;");
  const file = 'function f() {\n  return 1;\n}\n';
  const fine = [{ path: 'src/a.ts', search: '  return 1;', replace: "  const s = '{ (';\n  return 1;" }];
  assert.deepEqual(reviewEdits(fine, () => file).map((f) => f.id), []);
});
test('repairRequest lists the problems and the fixable findings, not the warnings', () => {
  const findings = [
    { path: 'a.tsx', severity: 'fix' as const, id: 'fake_feature', ar: 'وهمي' },
    { path: 'a.tsx', severity: 'warn' as const, id: 'todo', ar: 'تودو' },
  ];
  assert.equal(mustFix(findings).length, 1);
  const req = repairRequest(['a.tsx: الجزء القديم مش موجود'], findings);
  assert.ok(req.includes('الجزء القديم مش موجود') && req.includes('a.tsx: وهمي') && !req.includes('تودو'));
  assert.match(selfCheckNote(1, 0), /صلّحت/);
  assert.match(selfCheckNote(2, 1), /الكارت/);
});
test('fitHistory keeps the newest turns under the server limit', () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({ by: i % 2 ? 'shaheen' : 'owner', text: 'x'.repeat(4000) }));
  const fit = fitHistory(turns);
  assert.ok(fit.reduce((n, t) => n + t.text.length, 0) <= 38_000);
  assert.equal(fit.at(-1), turns.at(-1));
  assert.equal(fitHistory([{ text: 'x'.repeat(50_000) }, { text: 'y' }]).length, 2, 'never fewer than two');
});

// ── «دفتر الدروس» ─────────────────────────────────────────────────────────────────────────────────────────
test('the bundled notebook is valid and keeps the lessons of real mistakes', () => {
  const lessons = readLessons(bundledLessons);
  assert.ok(lessons.length >= 5 && lessons.length <= LESSONS_MAX);
  assert.ok(lessons.some((l) => /alert/.test(l.text)) && lessons.some((l) => /t\(\)/.test(l.text)));
  assert.match(lessonsBrief(lessons), /^- /);
  assert.match(lessonsBrief([]), /لسه مفيش/);
  assert.deepEqual(readLessons([{ at: '2026-01-01', text: 'no' }, 'x', { text: 'missing date here' }]), []);
});
test('a lesson becomes a small change on the notebook that applies cleanly', () => {
  const current = readFileSync(join(root, LESSONS_PATH), 'utf8');
  const reply = 'تمام اتعلمت. [[درس: قبل ما أضيف تاب أتأكد من اسمه في App.tsx]]';
  const texts = lessonMarks(reply);
  assert.deepEqual(texts, ['قبل ما أضيف تاب أتأكد من اسمه في App.tsx']);
  const edit = lessonsEdit(current, texts, '2026-11-15')!;
  const plan = planChange([edit], () => current);
  assert.deepEqual(plan.problems, []);
  const after = JSON.parse(plan.files[0]!.after) as { text: string }[];
  assert.equal(after.length, readLessons(bundledLessons).length + 1);
  assert.equal(after.at(-1)!.text, texts[0]);
  // The reply now carries the change block the card reads, and no bracket mark.
  const out = withLessonChange(reply, edit);
  assert.ok(!/\[\[درس/.test(out) && /📝 درس جديد/.test(out));
  assert.deepEqual(parseChanges(out), [{ ...edit, replace: edit.replace.replace(/\n$/, '') }]);
  // A lesson already in the notebook is not added twice; personal numbers are masked.
  assert.equal(lessonsEdit(current, [readLessons(bundledLessons)[0]!.text], '2026-11-15'), undefined);
  assert.equal(lessonMarks('[[درس: كلم العميل على 0101 234 5678 أو a.b@x.com]]').join(''), 'كلم العميل على ••• أو •••');
  // An empty or missing notebook starts cleanly.
  assert.deepEqual(JSON.parse(planChange([lessonsEdit('[]\n', ['درس أول مهم'], '2026-11-15')!], () => '[]\n').files[0]!.after), [{ at: '2026-11-15', text: 'درس أول مهم' }]);
  assert.equal(lessonsEdit(undefined, ['درس أول مهم'], '2026-11-15')!.search, '');
});

// ── Wiring ────────────────────────────────────────────────────────────────────────────────────────────────
test('the owner room teaches the coding method and the room runs search, review and lessons', () => {
  const server = readFileSync(join(root, 'server/ownerRoom.ts'), 'utf8');
  for (const piece of ['[[ابحث:', '[[درس:', 'THINKING_CRAFT_INSTRUCTION', 'lessonsBrief(readLessons(bundledLessons))', 'طريقة شغلك كوكيل برمجة محترف']) assert.ok(server.includes(piece), piece);
  const room = readFileSync(join(root, 'src/admin/OwnerRoom.tsx'), 'utf8');
  for (const piece of ['searchRequests(', 'repoCodeMap()', 'reviewEdits(', 'repairRequest(', 'FILE_LIMITS.fixes', 'lessonMarks(']) assert.ok(room.includes(piece), piece);
  assert.ok(readFileSync(join(root, 'src/admin/ChangeCard.tsx'), 'utf8').includes('reviewEdits('));
  assert.ok(readFileSync(join(root, 'vite.config.ts'), 'utf8').includes('codeMapPlugin('));
});
