/**
 * «وكيل اللغات» — Shaheen's language-specialist runner (.github/workflows/shaheen-languages.yml).
 *
 * No network, no AI engine: walks the visitor source tree, measures the
 * store/banner pack coverage through the public لغات APIs, and writes its
 * findings to src/data/live/shaheen-languages.json — where the daily council
 * (scripts/shaheen-council) reads them into the briefing as experience-area
 * facts/signals. Pure checks live in ./audit.ts.
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
import {
  buildLanguageReport,
  findBareLocaleFormatting,
  findLanguageClamps,
  findNativeNumberInputs,
  type LanguageFinding,
  type LanguagePackCoverage,
} from './audit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIVE_FILE = join(ROOT, 'src', 'data', 'live', 'shaheen-languages.json');

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

function main(): void {
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
  ].join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, { flag: 'a' });
  }
}

try {
  main();
} catch (error) {
  console.error('تعذّر تشغيل وكيل اللغات:', error instanceof Error ? error.message : error);
  process.exit(1);
}
