/**
 * «فحص السيو لكل صفحة»: the live SEO agent reads ~10 pages per run (to stay polite), so its 100/100 is not proof that
 * all 1,100+ built pages are sound (council task #182). This check reads EVERY page of the built site with the same
 * rules (src/seo/audit.ts) plus cross-page duplicate titles and descriptions, after each Pages build.
 *   node --import tsx scripts/seo-check-all.mts pages-dist
 * Critical findings stop the deploy; the rest are listed as warnings in the run summary.
 */
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { auditPage, decodeEntities, scoreFindings, summarize, type PageAuditInput, type SeoFinding } from '../src/seo/audit';

export function pageKind(path: string): PageAuditInput['kind'] {
  if (path === 'index.html') return 'home';
  if (path === 'p/index.html') return 'product-index';
  if (path.startsWith('p/')) return 'product';
  if (path.startsWith('tools/') && path !== 'tools/index.html') return 'tool';
  return 'other';
}

/** Files that are not pages a search engine should judge (verification stubs, the SPA 404 copy of the home page). */
const SKIP = /^(?:google[\w-]*\.html|BingSiteAuth\.xml|404\.html)$/;

export function auditBuiltPages(pages: { path: string; html: string }[], siteUrl = 'https://example.com/') {
  const findings: SeoFinding[] = [];
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  for (const { path, html } of pages) {
    const url = new URL(path.replace(/(^|\/)index\.html$/, '$1'), siteUrl).href;
    findings.push(...auditPage({ url, html, kind: pageKind(path), bytes: Buffer.byteLength(html) }));
    if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) continue;
    const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const description = decodeEntities(html.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || '').trim();
    if (title) titles.set(title, [...(titles.get(title) || []), url]);
    if (description) descriptions.set(description, [...(descriptions.get(description) || []), url]);
  }
  for (const [title, urls] of titles) if (urls.length > 1) findings.push({
    id: `content:${urls[1]}:duplicatedTitle`, area: 'content', severity: 'major', page: urls[1],
    title: 'عنوان مكرر بين صفحات', detail: `العنوان «${title}» في ${urls.length} صفحات: ${urls.slice(0, 4).join('، ')}`, fix: 'اجعل عنوان كل صفحة فريداً ويصف محتواها.',
  });
  for (const [, urls] of descriptions) if (urls.length > 1) findings.push({
    id: `content:${urls[1]}:duplicatedDescription`, area: 'content', severity: 'minor', page: urls[1],
    title: 'وصف تعريف مكرر', detail: `نفس الوصف في ${urls.length} صفحات: ${urls.slice(0, 4).join('، ')}`, fix: 'اكتب وصفاً خاصاً بكل صفحة.',
  });
  const unique = [...new Map(findings.map((f) => [f.id, f])).values()];
  return { pages: pages.length, findings: unique, score: scoreFindings(unique), ...summarize(unique) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || 'pages-dist';
  const pages: { path: string; html: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { if (name !== 'assets') walk(full); continue; }
      const path = relative(root, full).split(sep).join('/');
      if (name.endsWith('.html') && !SKIP.test(path)) pages.push({ path, html: readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  // The address the build wrote into canonical links (the home page's own canonical).
  const home = pages.find((p) => p.path === 'index.html')?.html || '';
  const siteUrl = process.argv[3] || home.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || 'https://example.com/';
  const result = auditBuiltPages(pages, siteUrl);
  const { critical, major, minor } = result.bySeverity;
  const byCheck = new Map<string, SeoFinding[]>();
  for (const f of result.findings) { const k = `${f.severity}: ${f.title}`; byCheck.set(k, [...(byCheck.get(k) || []), f]); }
  const lines = [...byCheck].sort((a, b) => b[1].length - a[1].length).map(([k, list]) => `- ${k} — ${list.length} صفحة (مثلاً ${list.slice(0, 3).map((f) => f.page).join('، ')})`);
  console.log(`فحص السيو لكل الصفحات: ${result.pages} صفحة · حرجة ${critical} · كبيرة ${major} · صغيرة ${minor}`);
  for (const line of lines.slice(0, 20)) console.log(line);
  for (const f of result.findings.filter((x) => x.severity !== 'minor').slice(0, 10)) console.log(`::warning title=سيو ${f.page}::${f.title} — ${f.detail}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, [`## فحص السيو لكل صفحة (${result.pages})`, `حرجة ${critical} · كبيرة ${major} · صغيرة ${minor}`, ...lines.slice(0, 30), ''].join('\n'));
  if (critical > 0) { console.error(`::error title=فحص السيو::${critical} مشكلة حرجة — راجع القائمة أعلاه.`); process.exit(1); }
}
