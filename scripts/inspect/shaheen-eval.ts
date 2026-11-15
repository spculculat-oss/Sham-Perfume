/**
 * «امتحان شاهين» — a fixed benchmark run after every upgrade of Shaheen's thinking and coding tools
 * (tests/shaheenCoder.test.ts). It needs no network and no AI: it measures the parts that decide the quality of a
 * reply around the model — understanding the question, the check before sending, the review of a code change, and
 * finding the right file. A case that starts failing after a change is a step back; new cases are added, none
 * removed, so the score can only be kept or raised.
 */
import { profileQuestion, reviewReply, type QuestionKind } from '../../src/utils/thinkingCraft';
import { reviewEdits } from '../../src/utils/shaheenCoder';
import { searchCodeMap, type CodeMap } from '../../src/utils/codeMap';
import type { FileEdit } from '../../src/utils/ownerFiles';

export interface UnderstandCase { q: string; kind?: QuestionKind; vague?: boolean; questions?: number }
export interface ReviewCase { name: string; q: string; reply: string; expect: string[]; absent?: string[] }
export interface CoderCase { name: string; files: Record<string, string>; edits: FileEdit[]; expect: string[]; absent?: string[] }
export interface SearchCase { q: string; top: string; within?: number }

export const UNDERSTAND_CASES: UnderstandCase[] = [
  { q: 'إيه الفرق بين العطر الزيتي والكحولي؟', kind: 'compare' },
  { q: 'ايه احسن عطر EDP ولا EDT للصيف؟', kind: 'compare' },
  { q: 'ازاي أعمل كريم مرطب في البيت', kind: 'howto' },
  { q: 'خطوات تركيب صابون طبيعي', kind: 'howto' },
  { q: 'رأيك أسيب شغلي وأبدأ مشروع؟', kind: 'debate' },
  { q: 'عندي error في الكود ده', kind: 'code' },
  { q: 'اكتبلي function بالجافاسكريبت تحسب المتوسط', kind: 'code' },
  { q: 'اعملي خطة تسويق لمتجر عطور', kind: 'plan' },
  { q: 'اشرحلي يعني إيه IFRA', kind: 'explain' },
  { q: 'اكتبلي كابشن لبوست عطر', kind: 'creative' },
  { q: 'أنا زعلان ومخنوق النهارده', kind: 'feelings' },
  { q: 'what is the difference between EDP and EDT?', kind: 'compare' },
  { q: 'write a python script that renames files', kind: 'code' },
  { q: 'ساعدني', vague: true },
  { q: 'عايز حاجة', vague: true },
  { q: 'إيه الفرق بين ده وده؟ وأيهم أرخص؟', questions: 2 },
];

const LONG_EN = 'This is a long english reply that keeps going about the topic in detail. '.repeat(6);
const WALL = 'العطر الزيتي بيتعمل من زيوت عطرية مركزة من غير كحول وبيعيش على الجلد مدة أطول وبيبقى ريحته قريبة من الجسم وده بيخليه مناسب للي بيحب الريحة الهادية '.repeat(12);
export const REVIEW_CASES: ReviewCase[] = [
  { name: 'Arabic question, English answer', q: 'ازاي أعمل عطر في البيت؟', reply: LONG_EN, expect: ['language'] },
  { name: 'English question, Arabic answer', q: 'How do I make perfume at home?', reply: WALL, expect: ['language'] },
  { name: 'open code block', q: 'اكتبلي كود', reply: 'اتفضل:\n```js\nconsole.log(1)', expect: ['open_fence'] },
  { name: 'stuck repeating', q: 'احكيلي عن العود', reply: 'العود ريحته حلوة جدا. '.repeat(12), expect: ['repeat'] },
  { name: 'cut in the middle', q: 'اشرحلي النوتات', reply: `${'النوتات العليا هي أول ما تشمه في العطر وبتختفي بسرعة. '.repeat(10)}وبعدها بتيجي النوتات`, expect: ['cut'] },
  { name: 'one wall of text', q: 'احكيلي عن العطور الزيتية', reply: `${WALL}.`, expect: ['wall'] },
  { name: 'comparison without a table', q: 'إيه الفرق بين EDP و EDT؟', reply: `${'الفرق إن الأول تركيزه أعلى والتاني أخف وبيعيش أقل على الجلد. '.repeat(8)}.`, expect: ['compare_table'] },
  { name: 'how-to without steps', q: 'ازاي أعمل صابون طبيعي؟', reply: `${'هتجيب زيت وصودا وتخلطهم بحرص وتسيبهم يتماسكوا كام أسبوع قبل الاستخدام. '.repeat(7)}.`, expect: ['steps'] },
  { name: 'partial code', q: 'اكتبلي function تحسب المتوسط', reply: '```js\nfunction avg(a) {\n  // ...\n}\n```\nباقي الكود زي ما هو.', expect: ['partial_code'] },
  { name: 'two questions, tiny answer', q: 'إيه أحسن عطر للصيف؟ وبكام؟', reply: 'عطر الليمون.', expect: ['all_parts'] },
  {
    name: 'a good structured answer passes clean',
    q: 'إيه الفرق بين EDP و EDT؟',
    reply: 'الفرق الأساسي في التركيز ومدة الثبات:\n\n| النوع | التركيز | الثبات |\n| --- | --- | --- |\n| EDP | 15–20% | 6–8 ساعات |\n| EDT | 5–15% | 3–5 ساعات |\n\nلو بتحب ريحة تعيش طول اليوم خد EDP، ولو للصيف والشغل EDT أخف.',
    expect: [],
    absent: ['language', 'compare_table', 'wall', 'cut', 'repeat'],
  },
];

const HERO = `import { useState } from 'react';\n\nexport default function Hero({ t }: { t: (k: string) => string }) {\n  const [open, setOpen] = useState(false);\n  return (\n    <section>\n      <h1>{t('hero_title')}</h1>\n      <button onClick={() => setOpen(!open)}>{t('hero_cta')}</button>\n    </section>\n  );\n}\n`;
const HERO_PATH = 'src/components/Hero.tsx';
const swap = (search: string, replace: string): FileEdit[] => [{ path: HERO_PATH, search, replace }];
export const CODER_CASES: CoderCase[] = [
  { name: 'fake save button (#563)', files: { [HERO_PATH]: HERO }, edits: swap("      <h1>{t('hero_title')}</h1>", "      <h1>{t('hero_title')}</h1>\n      <button onClick={() => alert('saved')}>{t('save')}</button>"), expect: ['fake_feature'] },
  { name: 't() with a sentence (#548)', files: { [HERO_PATH]: HERO }, edits: swap("{t('hero_cta')}", "{t('تسوق مستحضرات التجميل')}"), expect: ['t_literal'] },
  { name: 'Arabic written into the screen', files: { [HERO_PATH]: HERO }, edits: swap("      <h1>{t('hero_title')}</h1>", '      <h1>أهلاً بيك في شام</h1>'), expect: ['hardcoded_text'] },
  { name: 'unbalanced brackets', files: { [HERO_PATH]: HERO }, edits: swap('  const [open, setOpen] = useState(false);', '  const [open, setOpen] = useState(false);\n  if (open) {'), expect: ['brackets'] },
  { name: '«rest of the code»', files: { [HERO_PATH]: HERO }, edits: swap("      <h1>{t('hero_title')}</h1>", "      <h1>{t('hero_title')}</h1>\n      {/* ... rest of the code */}"), expect: ['elision'] },
  { name: 'number input', files: { [HERO_PATH]: HERO }, edits: swap("      <h1>{t('hero_title')}</h1>", "      <h1>{t('hero_title')}</h1>\n      <input type=\"number\" />"), expect: ['number_input'] },
  { name: 'a key in the code', files: { [HERO_PATH]: HERO }, edits: swap('  const [open, setOpen] = useState(false);', `  const key = 'AIza${'Sy'.padEnd(35, 'x')}';\n  const [open, setOpen] = useState(false);`), expect: ['secret'] },
  { name: 'browser file importing the server', files: { [HERO_PATH]: HERO }, edits: swap("import { useState } from 'react';", "import { useState } from 'react';\nimport { callEngine } from '../../server/core/engines';"), expect: ['server_import'] },
  { name: 'broken JSON', files: { 'src/data/shaheen/notes.json': '{\n  "a": 1\n}\n' }, edits: [{ path: 'src/data/shaheen/notes.json', search: '  "a": 1', replace: '  "a": 1,\n  "b": ' }], expect: ['json'] },
  {
    name: 'a clean translated change passes',
    files: { [HERO_PATH]: HERO },
    edits: swap("      <button onClick={() => setOpen(!open)}>{t('hero_cta')}</button>", "      <button onClick={() => setOpen(!open)}>{t('hero_cta')}</button>\n      <a href=\"#cosmetics\">{t('hero_cosmetics')}</a>"),
    expect: [],
    absent: ['fake_feature', 't_literal', 'hardcoded_text', 'brackets', 'elision', 'number_input', 'secret', 'server_import', 'json'],
  },
];

/** Finding the right file from the owner's words (Arabic or English), against the real code map. */
export const SEARCH_CASES: SearchCase[] = [
  { q: 'قسم التجميل', top: 'src/components/CosmeticsHub.tsx' },
  { q: 'الفوتر', top: 'src/components/Footer.tsx' },
  { q: 'سلة التسوق', top: 'src/utils/storeCart.ts', within: 4 },
  { q: 'غرفة شاهين الخاصة', top: 'src/admin/OwnerRoom.tsx' },
  { q: 'Hero', top: 'src/components/Hero.tsx' },
  { q: 'ودن شاهين', top: 'src/utils/voiceEar.ts' },
  { q: 'جناح صاحب الموقع', top: 'src/admin/OwnerSuite.tsx', within: 4 },
];

export interface EvalResult { section: string; name: string; ok: boolean; detail?: string }
export interface EvalReport { passed: number; total: number; score: number; results: EvalResult[] }

/** Runs every case. Without a code map the search section is skipped (and not counted). */
export function runShaheenEval(map?: CodeMap): EvalReport {
  const results: EvalResult[] = [];
  for (const c of UNDERSTAND_CASES) {
    const p = profileQuestion(c.q);
    const bad = [
      c.kind && p.kind !== c.kind ? `kind ${p.kind}≠${c.kind}` : '',
      c.vague !== undefined && p.vague !== c.vague ? `vague ${p.vague}` : '',
      c.questions !== undefined && p.questions !== c.questions ? `questions ${p.questions}` : '',
    ].filter(Boolean).join(', ');
    results.push({ section: 'understand', name: c.q, ok: !bad, ...(bad ? { detail: bad } : {}) });
  }
  for (const c of REVIEW_CASES) {
    const ids = reviewReply(c.q, c.reply).map((n) => n.id);
    const missing = c.expect.filter((id) => !ids.includes(id));
    const extra = (c.absent || []).filter((id) => ids.includes(id));
    const ok = !missing.length && !extra.length;
    results.push({ section: 'review', name: c.name, ok, ...(ok ? {} : { detail: `got [${ids.join(', ')}]` }) });
  }
  for (const c of CODER_CASES) {
    const ids = reviewEdits(c.edits, (p) => c.files[p]).map((f) => f.id);
    const missing = c.expect.filter((id) => !ids.includes(id));
    const extra = (c.absent || []).filter((id) => ids.includes(id));
    const ok = !missing.length && !extra.length;
    results.push({ section: 'coder', name: c.name, ok, ...(ok ? {} : { detail: `got [${ids.join(', ')}]` }) });
  }
  if (map) {
    for (const c of SEARCH_CASES) {
      const hits = searchCodeMap(map, c.q, c.within || 3).map((h) => h.path);
      const ok = hits.includes(c.top);
      results.push({ section: 'search', name: c.q, ok, ...(ok ? {} : { detail: `got [${hits.join(', ')}]` }) });
    }
  }
  const passed = results.filter((r) => r.ok).length;
  return { passed, total: results.length, score: results.length ? Math.round((passed / results.length) * 100) : 0, results };
}
