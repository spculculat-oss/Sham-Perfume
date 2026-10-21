/**
 * «المترجم الذكي» — Shaheen's language agent turned into an AI translation tool, linked with the design
 * department. No network here: the engines are fakes, the checks and the site's resolvers are real.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  auditLanguages, auditPhrases, findPhysicalDirection, harvestInlineTexts, isVisibleEnglishLine, locatePhrases, mergePack, missingFor, planWork,
  readReview, readTranslations, translatePrompt, validateTranslation, type AiPackFile, type TextUnit,
} from '../scripts/shaheen-languages/translator';
import { smartTranslate } from '../scripts/shaheen-languages/smart';
import { auditPrompt } from '../scripts/shaheen-manus/audit';
import { buildBriefing } from '../scripts/shaheen-council/council';
import { clearAiPacks, registerAiPack } from '../src/لغات/aiPacks';
import { t, TRANSLATIONS } from '../src/لغات/i18n';
import { loc } from '../src/لغات/localize';
import { storeText, storeLanguageCoverage } from '../src/لغات/storeL10n';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import type { StoreTextKey } from '../src/لغات/storeKeys';

const ROOT = join(import.meta.dirname, '..');

test('a translation is accepted only when it is real, complete and in the language’s own script', () => {
  assert.equal(validateTranslation('de', 'Add {count} items to cart', '{count} Artikel in den Warenkorb legen'), undefined);
  assert.equal(validateTranslation('ru', 'Open the calculator', 'Открыть калькулятор'), undefined);
  assert.equal(validateTranslation('ja', 'Open the calculator', '計算機を開く'), undefined);
  assert.equal(validateTranslation('sr', 'Open the calculator', 'Otvori kalkulator'), undefined, 'Serbian in Latin letters is fine');
  assert.equal(validateTranslation('fa', 'Open the calculator', 'ماشین‌حساب را باز کنید'), undefined);
  assert.equal(validateTranslation('de', 'Add {count} items', 'Artikel hinzufügen'), 'placeholders');
  assert.equal(validateTranslation('ru', 'Open the calculator', 'Open the calculator'), 'wrong_script');
  assert.equal(validateTranslation('fr', 'Open the calculator', 'Open the calculator'), 'copy_of_english');
  assert.equal(validateTranslation('de', 'Open the calculator', 'افتح الحاسبة'), 'arabic_in_non_arabic_language');
  assert.equal(validateTranslation('de', 'Save', ''), 'empty');
  assert.equal(validateTranslation('de', 'Save', 'x'.repeat(80)), 'too_long');
  assert.equal(validateTranslation('de', 'Read <b>more</b>', 'Mehr lesen'), 'markup');
  assert.equal(validateTranslation('de', 'Save', 'Sure! Speichern'), 'chatter');
  assert.equal(validateTranslation('de', 'Sham', 'Sham'), undefined, 'a one-word brand may stay as it is');
  assert.equal(validateTranslation('de', 'Save', 42), 'not_text');
});

test('inline {ar, en, …} dictionaries are harvested with the languages they already have', () => {
  const source = [
    "  live_sync: { ar: 'متصل بالمعمل', en: 'Live Sync', fr: 'Sync en direct', de: 'Live-Sync' },",
    "  quote: { ar: 'نص', en: 'It\\'s ready' },",
    "  // not a dictionary: en: 'nothing'",
    "  num: { ar: '٥', en: '5' },",
  ].join('\n');
  const hits = harvestInlineTexts(source);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].en, 'Live Sync');
  assert.deepEqual([...hits[0].langs].sort(), ['ar', 'de', 'en', 'fr']);
  assert.equal(hits[0].line, 1);
  assert.equal(hits[1].en, "It's ready");
});

test('what a language still shows in English: missing, or a hand-made copy of the English', () => {
  const units: TextUnit[] = [
    { pack: 'ui', key: 'a', en: 'Open the lab', tier: 1 },
    { pack: 'ui', key: 'b', en: 'Close the lab', tier: 1 },
    { pack: 'ui', key: 'c', en: 'Sham', tier: 1 },
    { pack: 'ui', key: 'd', en: 'Read more', tier: 1 },
  ];
  const own: Record<string, string> = { a: 'Labor öffnen', b: 'Close the lab', c: 'Sham' };
  const ai: AiPackFile = { ui: { d: 'Mehr lesen' } };
  assert.deepEqual(missingFor('de', units, (u) => own[u.key], ai).map((u) => u.key), ['b']);
});

test('the design department steers the work: its half-translated languages first, its quotes located in the code', () => {
  const audit = { issues: [
    { area: 'languages', language: 'is,sq,ps', problem: 'النصوص في is/sq/ps جزئية' },
    { area: 'languages', language: 'ar', problem: 'عبارات مثل SHAM · SCENT STUDIO وLive Sync وEnter Portal بالإنجليزي' },
    { area: 'design', language: 'all', problem: 'Header cut at 390px' },
  ] };
  const langs = SUPPORTED_LANGUAGES.map((l) => l.code);
  assert.deepEqual(auditLanguages(audit, langs), ['is', 'sq', 'ps']);
  const phrases = auditPhrases(audit);
  assert.ok(phrases.includes('Live Sync') && phrases.includes('Enter Portal'), phrases.join(' | '));
  assert.ok(!phrases.includes('Header cut at'), 'design-only issues are not language quotes');
  const files = [
    { file: 'src/components/HomeHub.tsx', source: "x\n  live_sync: { ar: 'متصل', en: 'Live Sync' },\n  // Live Sync in a comment" },
    { file: 'src/components/Other.tsx', source: 'nothing here' },
  ];
  // The dictionary line is the translation source, not a hard-coded label: it is not a place to fix.
  assert.deepEqual(locatePhrases(['Live Sync'], files), []);
  const screen = [
    { file: 'src/components/Panel.tsx', source: "<div>\n  <h2>Live Sync</h2>\n  <input placeholder={L('placeholder')} />\n</div>" },
    { file: 'src/components/Dictionary.tsx', source: "  live_sync: { ar: 'متصل', en: 'Live Sync' }," },
  ];
  assert.deepEqual(locatePhrases(['Live Sync'], screen), [{ phrase: 'Live Sync', file: 'src/components/Panel.tsx', line: 2 }]);
  assert.deepEqual(locatePhrases(['placeholder'], screen), [], 'a translation key is not English text on the screen');
  assert.equal(findPhysicalDirection('<div className="ml-2 pr-4 text-left ms-2" /><p className="mx-2" />'), 3);
});

test('the work plan: short interface words for every language before long screen texts; batches stay small', () => {
  const unit = (key: string, tier: 1 | 2, en = 'Some words here'): TextUnit => ({ pack: tier === 1 ? 'ui' : 'text', key, en, tier });
  const gaps = {
    fr: [unit('a', 1), unit('b', 2)],
    is: [unit('c', 1), ...Array.from({ length: 5 }, (_, i) => unit(`t${i}`, 2))],
  };
  const plan = planWork(gaps, ['fr', 'is'], ['is'], 2);
  assert.deepEqual(plan.map((w) => `${w.lang}:${w.tier}:${w.units.length}`), ['is:1:1', 'fr:1:1', 'is:2:2', 'is:2:2', 'is:2:1', 'fr:2:1']);
});

test('replies are read strictly: bad items rejected one by one, the rest kept; reviews need a real verdict', () => {
  const units: TextUnit[] = [
    { pack: 'ui', key: 'a', en: 'Open {name} lab', tier: 1 },
    { pack: 'ui', key: 'b', en: 'Close the lab', tier: 1 },
    { pack: 'ui', key: 'c', en: 'Read more', tier: 1 },
  ];
  const reply = 'Here you go:\n```json\n{"1": "«{name} Labor öffnen»", "2": "Close the lab"}\n```';
  const { accepted, rejected } = readTranslations('de', units, reply);
  assert.deepEqual(accepted.map((a) => [a.unit.key, a.text]), [['a', '{name} Labor öffnen']]);
  assert.deepEqual(rejected.map((r) => [r.unit.key, r.reason]), [['b', 'copy_of_english'], ['c', 'missing']]);
  assert.match(translatePrompt(units, [['Calculator', 'Rechner']]), /Calculator → Rechner/);
  assert.deepEqual([...readReview('{"bad": {"2": "wrong meaning", "9": "x"}}', 3)!], [1]);
  assert.equal(readReview('no json', 3), undefined);
  const merged = mergePack({ ui: { z: 'Z' } }, accepted);
  assert.deepEqual(Object.keys(merged.ui!), ['a', 'z'], 'keys sorted for stable diffs');
  assert.equal(merged.store, undefined);
});

/** A fake engine that translates by the English text of each id in the prompt. */
const fakeEngine = (dict: Record<string, string>) => (prompt: string) => {
  const items = JSON.parse(prompt.slice(prompt.indexOf('{'), prompt.indexOf('}\n\nAnswer') + 1)) as Record<string, string>;
  return JSON.stringify(Object.fromEntries(Object.entries(items).map(([id, en]) => [id, dict[en] ?? en])));
};

function harness(over: Partial<Parameters<typeof smartTranslate>[0]> = {}) {
  const packs: Record<string, AiPackFile> = {};
  const units: TextUnit[] = [
    { pack: 'ui', key: 'open', en: 'Open the lab', tier: 1 },
    { pack: 'ui', key: 'close', en: 'Close the lab', tier: 1 },
    { pack: 'text', key: 'Live Sync now', en: 'Live Sync now', tier: 2 },
  ];
  const deps = {
    languages: [{ code: 'ar', name: 'Arabic', nativeName: 'العربية' }, { code: 'en', name: 'English', nativeName: 'English' }, { code: 'de', name: 'German', nativeName: 'Deutsch' }],
    units, own: () => undefined, readPack: (l: string) => packs[l] || {}, writePack: (l: string, p: AiPackFile) => { packs[l] = p; },
    engines: ['perplexity'], priority: [], maxCalls: 10, deadline: Date.parse('2026-10-19T10:00:00Z'), now: () => Date.parse('2026-10-19T09:00:00Z'),
    ...over,
  };
  return { packs, deps };
}

test('a run translates what is missing, keeps only what passes, and never touches Arabic or English', async () => {
  const prompts: string[] = [];
  const { packs, deps } = harness({
    ask: async (system, prompt) => {
      prompts.push(system);
      return fakeEngine({ 'Open the lab': 'Labor öffnen', 'Close the lab': 'Close the lab', 'Live Sync now': 'Live-Synchronisierung jetzt' })(prompt);
    },
  });
  const section = await smartTranslate(deps);
  assert.equal(section.status, 'done');
  assert.deepEqual(packs.de, { ui: { open: 'Labor öffnen' }, text: { 'Live Sync now': 'Live-Synchronisierung jetzt' } });
  assert.equal(packs.ar, undefined); assert.equal(packs.en, undefined);
  assert.equal(section.run.translated, 2);
  assert.equal(section.run.rejected, 1);
  assert.deepEqual(section.rejectReasons, { copy_of_english: 1 });
  assert.equal(section.remaining, 1, 'the rejected string waits for the next run — never filled with English');
  assert.equal(section.covered, 2);
  assert.match(prompts[0], /German \(Deutsch/);

  // The same string rejected twice is set aside, so it cannot eat the quota every run.
  const again = await smartTranslate({ ...deps, previous: section });
  assert.equal(again.run.rejected, 1);
  const third = await smartTranslate({ ...deps, previous: again, ask: async () => { throw new Error('must not be asked'); } });
  assert.equal(third.status, 'idle');
  assert.equal(third.remaining, 1, 'still counted as English, honestly');
});

test('a second engine reviews the batch and its rejections are dropped', async () => {
  const { packs, deps } = harness({
    ask: async (_s, prompt) => (prompt.includes('Live Sync now') ? '{"1": "Live-Synchronisierung jetzt"}' : '{"1": "Labor öffnen", "2": "Labor schließen"}'),
    review: async (_s, prompt) => (prompt.includes('Labor schließen') ? '{"bad": {"2": "wrong meaning"}}' : '{"bad": {}}'),
  });
  const section = await smartTranslate(deps);
  assert.equal(section.run.reviewed, true);
  assert.equal(section.run.droppedByReview, 1);
  assert.deepEqual(packs.de.ui, { open: 'Labor öffnen' });
});

test('no engine, used-up packages and the request budget stop the run honestly', async () => {
  assert.equal((await smartTranslate(harness().deps)).status, 'no_engine');
  assert.equal((await smartTranslate(harness({ maxCalls: 0, ask: async () => '{}' }).deps)).status, 'off');
  const quota = Object.assign(new Error('AI quota exhausted'), { name: 'QuotaExhaustedError', resumeAt: Date.parse('2026-10-20T08:05:00Z') });
  const stopped = await smartTranslate(harness({ ask: async () => { throw quota; } }).deps);
  assert.equal(stopped.status, 'quota');
  assert.equal(stopped.run.resumeAt, '2026-10-20T08:05:00.000Z');
  const failed = await smartTranslate(harness({ ask: async () => { throw new Error('no AI engine answered'); } }).deps);
  assert.equal(failed.status, 'engines_failed');
  const { packs, deps } = harness({ maxCalls: 1, ask: async () => '{"1": "Labor öffnen", "2": "Labor schließen"}' });
  const budget = await smartTranslate(deps);
  assert.equal(budget.run.calls, 1);
  assert.equal(budget.status, 'done');
  assert.equal(packs.de.text, undefined, 'the screen text waits for the next run');
});

test('the site reads the AI translation before falling back to English — hand-made text always wins', () => {
  const key = Object.keys(TRANSLATIONS.en).find((k) => !TRANSLATIONS.is?.[k])!;
  assert.ok(key, 'Icelandic has a missing interface key today');
  const english = TRANSLATIONS.en[key];
  const storeKey = storeLanguageCoverage('en').map((r) => r.key).find((k) => !storeLanguageCoverage('is').some((r) => r.key === k)) as StoreTextKey;
  try {
    assert.equal(t(key as never, 'is'), english, 'before: English');
    registerAiPack('is', { ui: { [key]: 'Íslensk þýðing', nav_calc: 'ekki nota' }, store: storeKey ? { [storeKey]: 'Verslun texti' } : {}, text: { 'Live Sync': 'Lifandi samstilling' } });
    registerAiPack('ar', { ui: { [key]: 'never' } });
    assert.equal(t(key as never, 'is'), 'Íslensk þýðing');
    assert.equal(t('nav_calc', 'is'), TRANSLATIONS.is.nav_calc, 'a hand-made translation wins');
    assert.equal(t(key as never, 'ar'), TRANSLATIONS.ar[key], 'Arabic is never replaced');
    assert.equal(t(key as never, 'en'), english);
    if (storeKey) assert.equal(storeText('is', storeKey), 'Verslun texti');
    assert.equal(loc('is', { ar: 'متصل', en: 'Live Sync' }), 'Lifandi samstilling');
    assert.equal(loc('is', { ar: 'متصل', en: 'Live Sync', is: 'Handgert' }), 'Handgert');
    assert.equal(loc('de', { ar: 'متصل', en: 'Live Sync' }), 'Live Sync', 'no pack → English as before');
  } finally {
    clearAiPacks();
  }
});

test('every committed AI translation passes the same checks (a bad pack can never reach visitors)', () => {
  const dir = join(ROOT, 'src/لغات/ai');
  const storeEn = Object.fromEntries(storeLanguageCoverage('en').map((r) => [r.key, r.text]));
  const codes = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const lang = file.replace(/\.json$/, '');
    assert.ok(codes.has(lang) && lang !== 'ar' && lang !== 'en', `${file}: not a translatable site language`);
    const pack = JSON.parse(readFileSync(join(dir, file), 'utf8')) as AiPackFile;
    for (const [k, v] of Object.entries(pack.ui || {})) assert.equal(validateTranslation(lang, TRANSLATIONS.en[k] ?? '', v), TRANSLATIONS.en[k] ? undefined : 'not_text', `${file} ui.${k}`);
    for (const [k, v] of Object.entries(pack.store || {})) assert.equal(storeEn[k] ? validateTranslation(lang, storeEn[k], v) : 'unknown key', undefined, `${file} store.${k}`);
    for (const [k, v] of Object.entries(pack.text || {})) assert.equal(validateTranslation(lang, k, v), undefined, `${file} text «${k.slice(0, 40)}»`);
  }
});

test('the design audit checks the languages the AI just translated, and the council hears both departments', () => {
  assert.match(auditPrompt(['ar', 'en', 'is'], undefined, ['is', 'sq']), /AI translator recently filled missing texts in: is, sq/);
  assert.ok(!auditPrompt(['ar', 'en']).includes('AI translator'));
  const report = JSON.parse(readFileSync(join(ROOT, 'src/data/live/shaheen-languages.json'), 'utf8'));
  const briefing = buildBriefing({ languages: {
    ...report,
    translation: { status: 'no_engine', remaining: 1200, covered: 300, run: { translated: 0, rejected: 0 } },
    design: { located: [{ phrase: 'Live Sync', file: 'src/components/HomeHub.tsx', line: 138 }] },
  } }, Date.parse('2026-10-19T07:00:00Z'), []);
  assert.ok(briefing.facts.some((f) => f.startsWith('المترجم الذكي: 1200')), briefing.facts.join('\n'));
  assert.ok(briefing.signals.some((s) => s.text.includes('المترجم الذكي واقف')));
  const task = briefing.signals.find((s) => s.decision?.title === 'مراجعة النصوص الإنجليزي اللي لقاها قسم التصميم');
  assert.ok(task?.decision?.detail.includes('src/components/HomeHub.tsx:138'));
});

test('the language agent does not chase phantom English: dictionaries and keys are not screen text', () => {
  assert.equal(isVisibleEnglishLine("  live_sync: { ar: 'متصل', en: 'Live Sync' },", 'Live Sync'), false);
  assert.equal(isVisibleEnglishLine('  <h2>Live Sync</h2>', 'Live Sync'), true);
  assert.equal(isVisibleEnglishLine("<input placeholder={L('placeholder')} />", 'placeholder'), false);
  assert.equal(isVisibleEnglishLine('  <span title="Enter Portal">x</span>', 'Enter Portal'), true);
  assert.equal(isVisibleEnglishLine("  'placeholder': { ar: 'اكتب', en: 'Type' },", 'placeholder'), false, 'an object key');
  assert.equal(isVisibleEnglishLine('export function LocalizedNumberInput({ value, placeholder, onChange }: Props) {', 'placeholder'), false, 'a variable name');
  assert.equal(isVisibleEnglishLine("placeholder={'اكتب سؤالك'}", 'placeholder'), false, 'an attribute name');
});
