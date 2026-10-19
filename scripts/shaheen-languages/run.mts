/**
 * «وكيل اللغات» — Shaheen's language-specialist runner (.github/workflows/shaheen-languages.yml).
 *
 * 1. The audit (no network): walks the visitor source tree, measures the store/banner pack coverage
 *    through the public لغات APIs (pure checks in ./audit.ts).
 * 2. «المترجم الذكي» (./smart.ts + ./translator.ts): every visitor string a language still shows in
 *    English is translated by Shaheen's AI engines (quota-aware, strict checks, a second engine reviews)
 *    into src/لغات/ai/<lang>.json — read by the site on demand.
 * 3. The link with the design department: the languages the design audit (manus-audit.json) found
 *    half-translated go first, and the English phrases it quoted are located in the code.
 *
 * Findings go to src/data/live/shaheen-languages.json — read by the pre-meeting check and the council.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LANGUAGES } from '../../src/types/i18n';
import { STORE_CORE_KEYS } from '../../src/لغات/storeKeys';
import { storeCoreCoverage, storeLanguageCoverage } from '../../src/لغات/storeL10n';
import { BANNER_KEYS } from '../../src/لغات/bannerKeys';
import { BANNER_PACKS } from '../../src/لغات/bannerL10n';
import type { SupportedLanguage } from '../../src/types/i18n';
import { TRANSLATIONS } from '../../src/لغات/i18n';
import { guidanceBlock } from '../../src/utils/aiTools';
import { configuredEngines, keyFingerprint, makeAsk, quotaBook } from '../doctor/agent';
import { smartTranslate } from './smart';
import { auditLanguages, auditPhrases, findPhysicalDirection, glossaryFor, harvestInlineTexts, locatePhrases, type AiPackFile, type TextUnit } from './translator';
import type { DesignSection, LanguageLiveReport, TranslationSection } from './audit';
import {
  buildLanguageReport,
  findBareLocaleFormatting,
  findLanguageClamps,
  findNativeNumberInputs,
  type LanguageFinding,
  type LanguagePackCoverage,
} from './audit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIVE_DIR = join(ROOT, 'src', 'data', 'live');
const LIVE_FILE = join(LIVE_DIR, 'shaheen-languages.json');
const AI_DIR = join(ROOT, 'src', 'لغات', 'ai');
const env = process.env;
const readJson = <T,>(path: string): T | undefined => { try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return undefined; } };
/** Content-heavy dictionaries (perfume library, materials, news): translated after the screens. */
const CONTENT_FILES = /src\/لغات\/(?!uiTextL10n|noteL10n|contentLabels|commonLabels)/;

const listSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) listSources(path, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(path);
  }
  return acc;
};

const rel = (path: string): string => path.slice(ROOT.length + 1).replaceAll('\\', '/');

const coverageOf = (lang: SupportedLanguage): LanguagePackCoverage => {
  // Banner rows are arrays aligned to BANNER_KEYS (dense; count non-empty cells).
  const bannerRow = (BANNER_PACKS[lang] || []) as unknown as readonly string[];
  return {
    storeCore: storeCoreCoverage(lang),
    storeTotal: storeLanguageCoverage(lang).length,
    banner: Array.isArray(bannerRow)
      ? bannerRow.filter((cell) => Boolean(cell)).length
      : BANNER_KEYS.filter((key) => Boolean((bannerRow as unknown as Record<string, string>)[key])).length,
  };
};

async function main(): Promise<void> {
  const publicNumberInputs: LanguageFinding[] = [];
  const operatorNumberInputs: LanguageFinding[] = [];
  const bareLocaleFormatting: LanguageFinding[] = [];
  const languageClamps: LanguageFinding[] = [];

  for (const path of listSources(join(ROOT, 'src')).sort()) {
    const file = rel(path);
    const source = readFileSync(path, 'utf8');
    const numbers = findNativeNumberInputs(file, source);
    publicNumberInputs.push(...numbers.public);
    operatorNumberInputs.push(...numbers.operator);
    bareLocaleFormatting.push(...findBareLocaleFormatting(file, source));
    languageClamps.push(...findLanguageClamps(file, source));
  }

  const languages = SUPPORTED_LANGUAGES.map((config) => config.code);
  const coverage: Record<string, LanguagePackCoverage> = {};
  for (const lang of languages) coverage[lang] = coverageOf(lang);

  const report = buildLanguageReport({
    at: new Date().toISOString(),
    languages,
    storeCoreSize: STORE_CORE_KEYS.length,
    bannerSize: BANNER_KEYS.length,
    coverage,
    publicNumberInputs,
    operatorNumberInputs,
    bareLocaleFormatting,
    languageClamps,
  });

  const visitorFiles = listSources(join(ROOT, 'src')).sort().map((path) => ({ file: rel(path), path }))
    .filter(({ file }) => !file.startsWith('src/admin/') && !file.startsWith('src/data/'));
  const sources = visitorFiles.map(({ file, path }) => ({ file, source: readFileSync(path, 'utf8') }));
  const previous = readJson<LanguageLiveReport>(LIVE_FILE);

  // ── The design department: its audit steers the translation, its quotes are located in the code ──
  const audit = readJson<{ updatedAt?: string; score?: number }>(join(LIVE_DIR, 'manus-audit.json'));
  const priority = auditLanguages(audit, languages);
  const phrases = auditPhrases(audit);
  const screens = sources.filter(({ file }) => !file.startsWith('src/لغات/'));
  const located = locatePhrases(phrases, screens);
  const direction = screens.map(({ file, source }) => ({ file, count: findPhysicalDirection(source) })).filter((x) => x.count);
  const design: DesignSection = {
    at: report.updatedAt, auditAt: audit?.updatedAt, auditScore: audit?.score, priorityLanguages: priority,
    located, unlocated: phrases.filter((p) => !located.some((l) => l.phrase === p)),
    physicalDirection: { total: direction.reduce((a, b) => a + b.count, 0), top: direction.sort((a, b) => b.count - a.count).slice(0, 8) },
  };

  // ── «المترجم الذكي» ──
  const enUi = TRANSLATIONS.en as Record<string, string>;
  const storeEn = Object.fromEntries(storeLanguageCoverage('en').map((r) => [r.key, r.text]));
  const units: TextUnit[] = [
    ...Object.keys(enUi).map((key) => ({ pack: 'ui' as const, key, en: enUi[key], tier: 1 as const })),
    ...Object.keys(storeEn).map((key) => ({ pack: 'store' as const, key, en: storeEn[key], tier: 1 as const })),
  ];
  // Inline {ar, en, …} dictionaries: a language counts as present for an English text only where every copy has it.
  const inline = new Map<string, { langs: Set<string> | null; tier: 2 | 3 }>();
  for (const { file, source } of sources) {
    for (const hit of harvestInlineTexts(source)) {
      const tier = CONTENT_FILES.test(file) || hit.en.length > 300 ? 3 : 2;
      const seen = inline.get(hit.en);
      if (!seen) inline.set(hit.en, { langs: hit.langs, tier });
      else {
        seen.langs = new Set([...(seen.langs || [])].filter((l) => hit.langs.has(l)));
        if (tier < seen.tier) seen.tier = tier;
      }
    }
  }
  for (const [en, { tier }] of inline) units.push({ pack: 'text', key: en, en, tier });
  const storeOwn = new Map<string, Record<string, string>>();
  const own = (lang: string, u: TextUnit): string | undefined => {
    if (u.pack === 'ui') return (TRANSLATIONS[lang as SupportedLanguage] as Record<string, string> | undefined)?.[u.key];
    if (u.pack === 'store') {
      if (!storeOwn.has(lang)) storeOwn.set(lang, Object.fromEntries(storeLanguageCoverage(lang as SupportedLanguage).map((r) => [r.key, r.text])));
      return storeOwn.get(lang)![u.key];
    }
    return inline.get(u.key)?.langs?.has(lang) ? '·' : undefined;
  };
  const packPath = (lang: string) => join(AI_DIR, `${lang}.json`);
  const readPack = (lang: string): AiPackFile => readJson<AiPackFile>(packPath(lang)) || {};
  const writePack = (lang: string, pack: AiPackFile) => { mkdirSync(AI_DIR, { recursive: true }); writeFileSync(packPath(lang), `${JSON.stringify(pack, null, 1)}\n`, 'utf8'); };

  const maxCalls = Number(env.LANG_AI_MAX_CALLS ?? 20);
  const quota = quotaBook(new URL('../../src/data/live/ai-quota.json', import.meta.url));
  const engines = await configuredEngines(env);
  const used = new Set<string>();
  const ready = engines.filter((id) => !quota.pausedUntil(id, keyFingerprint(env, id)));
  const supervisor = readJson<{ tools?: Record<string, { guidance?: { text?: string } }> }>(join(LIVE_DIR, 'ai-supervisor.json'));
  let ask: ((s: string, p: string) => Promise<string>) | undefined;
  let review: ((s: string, p: string) => Promise<string>) | undefined;
  if (maxCalls > 0 && engines.length) {
    ask = await makeAsk(env, { quota, maxWaitMs: 60_000, onEngine: (id) => used.add(id) });
    // The reviewer is another engine when two work; with one engine the strict checks are the review.
    const second = ready.find((id) => id !== ready[0]);
    if (second) review = await makeAsk(env, { quota, maxWaitMs: 60_000, prefer: second, onEngine: (id) => used.add(`${id} (review)`) });
  }
  const glossaryKeys = ['nav_calc', 'nav_news', 'nav_raw_materials', 'nav_pyramid', 'nav_alcohol', 'nav_costing', 'nav_library', 'nav_maceration', 'nav_ai_master', 'brand_name', 'nav_world_perfumes', 'nav_guide'];
  const translation: TranslationSection = await smartTranslate({
    languages: SUPPORTED_LANGUAGES, units, own, readPack, writePack, ask, review, engines, usedEngines: () => [...used],
    priority, maxCalls, deadline: Date.now() + Number(env.LANG_AI_TIME_BUDGET_S ?? 900) * 1000, now: Date.now,
    previous: previous?.translation, guidance: guidanceBlock(supervisor?.tools?.language_agent?.guidance?.text),
    glossary: (lang) => glossaryFor(TRANSLATIONS[lang as SupportedLanguage] as Record<string, string> | undefined, enUi, glossaryKeys),
  });
  quota.save();

  report.translation = translation;
  report.design = design;
  const STOP: Record<TranslationSection['status'], string> = {
    done: 'اشتغل النهارده', idle: 'مفيش حاجة ناقصة', no_engine: 'مستني مفتاح ذكاء اصطناعي شغال', quota: 'الباقة خلصت — هيكمل بعد التجديد',
    engines_failed: 'المحركات مردتش — هيحاول الدورة الجاية', budget: 'وقت الدورة خلص — هيكمل الدورة الجاية', off: 'متوقف بقرار الإعدادات',
  };
  report.notes.push(`المترجم الذكي: ${translation.remaining} نص × لغة لسه بالإنجليزي، والذكاء الاصطناعي غطّى ${translation.covered} — النهارده اتترجم ${translation.run.translated} (${STOP[translation.status]}).`);
  if (design.located.length) report.notes.push(`قسم التصميم لقى نصوص إنجليزي ثابتة، ومكانها في الكود: ${design.located.slice(0, 6).map((l) => `«${l.phrase}» ${l.file}:${l.line}`).join('، ')}.`);
  if (priority.length) report.notes.push(`لغات بلّغ عنها قسم التصميم بتتترجم الأول: ${priority.join('، ')}.`);

  mkdirSync(dirname(LIVE_FILE), { recursive: true });
  writeFileSync(LIVE_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`::notice title=وكيل اللغات::لغات مدعومة: ${report.languageCount} (مكتملة الحزم: ${report.fullyCovered}) · النتيجة ${report.score}/100`);
  for (const note of report.notes) console.log(`::notice title=ملاحظة لغوية::${note}`);
  for (const hit of report.publicNumberInputs.slice(0, 15)) {
    console.log(`::warning file=${hit.file},line=${hit.line}::حقل أرقام أصلي يتبع لغة متصفح الزائر — استبدله بـ LocalizedNumberInput`);
  }

  const list = (title: string, hits: LanguageFinding[]) =>
    `### ${title} (${hits.length})\n${hits.slice(0, 12).map((h) => `- \`${h.file}:${h.line}\``).join('\n')}${hits.length > 12 ? `\n- …و${hits.length - 12} أخرى` : ''}`;
  const summary = [
    '## وكيل اللغات — تحت إدارة شاهين',
    `- لغات الموقع: **${report.languageCount}** · مكتملة الحزم: **${report.fullyCovered}** · النتيجة: **${report.score}/100**`,
    ...report.notes.map((note) => `- ${note}`),
    list('حقول أرقام في واجهات الزوار (لغة المتصفح)', report.publicNumberInputs),
    list('حقول أرقام في واجهات المشغّلين', report.operatorNumberInputs),
    list('تنسيق بلا لغة صريحة', report.bareLocaleFormatting),
    list('تقليل صارم عربي/إنجليزي', report.languageClamps),
    '### المترجم الذكي',
    `- الحالة: **${translation.status}** · نداءات: ${translation.run.calls} · اتترجم: **${translation.run.translated}** · مرفوض: ${translation.run.rejected} (منهم ${translation.run.droppedByReview} رفضهم المراجع) · المحركات: ${translation.run.engines.join('، ') || '—'}`,
    `- لسه بالإنجليزي: **${translation.remaining}** (واجهة ومتجر ${translation.remainingByTier[1] ?? 0} · شاشات ${translation.remainingByTier[2] ?? 0} · محتوى ${translation.remainingByTier[3] ?? 0}) · مغطّى بالذكاء الاصطناعي: ${translation.covered}`,
    `- لغات النهارده: ${translation.run.languages.join('، ') || '—'}`,
    '### الربط مع قسم التصميم',
    `- لغات بالأولوية من تدقيق التصميم: ${design.priorityLanguages.join('، ') || '—'}`,
    ...design.located.map((l) => `- «${l.phrase}» → \`${l.file}:${l.line}\``),
    `- فئات يمين/شمال ثابتة (مش بتنعكس في اللغات من اليمين للشمال): ${design.physicalDirection.total}`,
  ].join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, { flag: 'a' });
  }
}

try {
  await main();
} catch (error) {
  console.error('تعذّر تشغيل وكيل اللغات:', error instanceof Error ? error.message : error);
  process.exit(1);
}
