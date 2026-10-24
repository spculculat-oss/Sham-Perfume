/**
 * «روبوت مراقبة جودة الترجمة واللغات» — GitHub Actions runs it every day, after the language agent
 * (`.github/workflows/shaheen-localization.yml`):  node --import tsx scripts/shaheen-localization/run.mts
 *
 * Feeds the pure audit (`./audit.ts`) with the site's real tables — every country and its official currency, the
 * day's exchange rates, the store packs of all languages, the currency each country would be charged in, and the
 * visitor-facing source — then writes `src/data/live/shaheen-localization.json` for «الفحص الشامل» and the council.
 * Env: KASHIER_CURRENCIES (the gateway's accepted currencies; unset = no gateway in this run, said plainly).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import countryCurrency from '../../src/data/country-currency.json';
import fxData from '../../src/data/live/fx-rates.json';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/types/i18n';
import { storeLanguageCoverage } from '../../src/لغات/storeL10n';
import { displayCurrency, languageHome, spokenIn } from '../../src/utils/displayCurrency';
import { HOME_CURRENCY, type FxTable } from '../../src/utils/pricing';
import { MONEY_KEYS, auditLocalization, type MoneyKey, type SourceFile } from './audit';

const ROOT = join(fileURLToPath(new URL('../../', import.meta.url)));
const env = process.env;
const now = Date.now();

const listSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) listSources(path, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(path);
  }
  return acc;
};
const rel = (path: string) => path.slice(ROOT.length).replaceAll('\\', '/');
const sources: SourceFile[] = listSources(join(ROOT, 'src'))
  .map((path) => rel(path))
  .filter((file) => !file.startsWith('src/admin/') && !file.startsWith('src/data/'))
  .map((file) => ({ file, code: readFileSync(join(ROOT, file), 'utf8') }));

const accepted = (env.KASHIER_CURRENCIES || '').split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c));
const fx = fxData as FxTable;

const report = auditLocalization({
  now,
  countries: countryCurrency as Record<string, string>,
  fx: { base: fx.base, ...(fx.updatedAt ? { updatedAt: fx.updatedAt } : {}), rates: fx.rates },
  accepted,
  home: HOME_CURRENCY,
  languages: SUPPORTED_LANGUAGES.map((l) => l.code),
  moneyText: (lang) => {
    const rows = storeLanguageCoverage(lang as SupportedLanguage);
    const out: Partial<Record<MoneyKey, string>> = {};
    for (const row of rows) if ((MONEY_KEYS as readonly string[]).includes(row.key)) out[row.key as MoneyKey] = row.text;
    return out;
  },
  languageHome,
  spokenIn,
  displayCurrency: (country, lang) => displayCurrency(country, lang as SupportedLanguage),
  sources,
});

writeFileSync(new URL('../../src/data/live/shaheen-localization.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
for (const line of report.planAr) console.log(`- ${line}`);
for (const note of report.notes) console.log(`! ${note}`);

if (env.GITHUB_STEP_SUMMARY) {
  const terms = report.moneyTerms.slice(0, 12).map((t) => `| ${t.language} | ${t.missing.join(', ')} |`);
  const gaps = report.rateGaps.slice(0, 12).map((g) => `| ${g.country} | ${g.currency} | ${g.shownAs} |`);
  const hard = report.hardcoded.slice(0, 12).map((h) => `| ${h.file}:${h.line} | ${h.text.replace(/\|/g, '\\|')} |`);
  const lines = [
    '## روبوت مراقبة جودة الترجمة واللغات',
    '',
    report.summaryAr,
    '',
    `- الدول: ${report.tables.countries} · العملات: ${report.tables.currencies} · اللغات: ${report.tables.languages}`,
    `- الدرجة: ${report.score}/100 · بوابة دفع مضبوطة: ${report.tables.gateway ? 'نعم' : 'لا'}`,
    '',
    '### الخطة',
    report.planAr.map((l) => `- ${l}`).join('\n') || '- لا يوجد',
    '',
    '### دول من غير سعر صرف لعملتها',
    '| الدولة | العملة | المعروض |',
    '|---|---|---|',
    gaps.join('\n') || '| — | — | — |',
    '',
    '### لغات ناقصة كلمات الفلوس',
    '| اللغة | الناقص |',
    '|---|---|',
    terms.join('\n') || '| — | — |',
    '',
    '### مبالغ ثابتة بعملة في كود الزوار',
    '| المكان | السطر |',
    '|---|---|',
    hard.join('\n') || '| — | — |',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen localization audit::${clip(report.summaryAr)}`);
  if (report.languageSwitch.bugs.length) console.log(`::warning title=Shaheen localization audit::${clip(`${report.languageSwitch.bugs.length} حالة عملة غلط للزائر`)}`);
  if (!report.tables.gateway) console.log(`::warning title=Shaheen localization audit::${clip('بوابة الدفع مش مضبوطة في التشغيل — فحص عملة الخصم اتعمل بالعرض بس')}`);
}
