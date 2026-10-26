/**
 * «تقرير منارة شاهين الأسبوعي للظهور والانتشار»
 *
 * Pure Markdown builder from the agent's live state (`SeoState`) so the owner can read one honest
 * digest of search visibility, crawler access, Lighthouse performance, curriculum progress and
 * ready-to-share social copy — in GitHub Actions step summaries, issues, or the CLI.
 */
import type { SeoState } from './agentState';
import { SEO_PAGES } from './pages';
import { SEO_AGENT, SITE, absoluteUrl } from './site';

export interface WeeklyReportOptions {
  siteUrl?: string;
  productsCount?: number;
  sitemapCount?: number;
  verificationOk?: boolean;
  now?: Date;
}

export function renderWeeklyVisibilityReport(state: SeoState, options: WeeklyReportOptions = {}): string {
  const siteUrl = options.siteUrl || SITE.url;
  const now = options.now || new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const productsCount = options.productsCount ?? 1114;
  const sitemapCount = options.sitemapCount ?? (SEO_PAGES.length + productsCount + 4);
  const crawl = state.discovery.crawl;
  const psi = state.discovery.pageSpeed;
  const webSub = state.discovery.webSub;
  const latestLesson = state.curriculum.notes[state.curriculum.notes.length - 1];
  const verifyStatus = options.verificationOk === false ? '⚠️ يحتاج مراجعة' : `✅ مفعل (google${SITE.googleVerification}.html)`;

  const lines: string[] = [
    `# تقرير «${SEO_AGENT.nameAr}» للظهور والانتشار — ${dateStr}`,
    '',
    `> إشراف: **${SEO_AGENT.reportsToAr}** · المرحلة الحالية: **${state.trust.level}** (دورة رقم ${state.trust.cycles}) · النطاق الأساسي: ${siteUrl}`,
    '',
    '## ١) مؤشرات الفحص والوصول الحية',
    '',
    '| المؤشر | القيمة | التفاصيل |',
    '|---|---|---|',
    `| تقييم الفحص الفني | **${state.audit.score}/100** | ${state.audit.pagesChecked} صفحات مفحوصة (حرجة: ${state.audit.bySeverity.critical} · كبيرة: ${state.audit.bySeverity.major} · صغيرة: ${state.audit.bySeverity.minor}) |`,
    `| وصول الزاحف (Googlebot) | **${crawl ? `${crawl.ok}/${crawl.checked}` : 'لم يُقس بعد'}** | ${crawl ? (crawl.ok === crawl.checked ? 'كل الصفحات المفحوصة متاحة للفهرسة' : 'توجد صفحة تحتاج مراجعة') : 'يُقاس في الدورة الحية'} |`,
    `| ملف تحقق Search Console | ${verifyStatus} | \`${absoluteUrl(`google${SITE.googleVerification}.html`, siteUrl)}\` |`,
    `| حجم خريطة الموقع | **${sitemapCount} رابطاً** | ${SEO_PAGES.length} صفحة أداة + صفحة الملف الإعلامي + ${productsCount} صفحة منتج |`,
    `| إشعار WebSub للخلاصة | ${webSub ? (webSub.ok ? '✅ تم الإشعار' : '⏳ لم يستجب المحور') : '⏳ في انتظار التغيير'} | بصمة الخلاصة: \`${webSub?.feedHash || '—'}\` |`,
    `| أداء الهاتف (Lighthouse) | ${psi?.ok ? `**أداء ${psi.scores.performance ?? '—'}/100 · SEO ${psi.scores.seo ?? '—'}/100**` : '⏳ يُقاس يومياً'} | ${psi?.detail || 'قياس عام بلا مفتاح'} |`,
    '',
    '## ٢) حالة قنوات البحث والاكتشاف',
    '',
    ...state.searchEngines.map(
      (engine) => `- **${engine.id === 'copilot' ? 'بحث Microsoft المتصل بفهرس Bing' : engine.nameAr}**: ${engine.status === 'submitted' ? '✅ أُرسل' : '🟢 جاهز'} — ${engine.detail || 'خريطة الموقع والخلاصة متاحتان'}`,
    ),
    '',
    '## ٣) التعلّم المستمر ومراجعة «الخبير شاهين»',
    '',
    `- **المنهج المدروس:** ${state.curriculum.studied.length} من 24 درساً${state.curriculum.completedAt ? ` (اكتمل في ${state.curriculum.completedAt.slice(0, 10)})` : ''}.`,
    ...(latestLesson
      ? [
          `- **آخر درس طُبّق (${latestLesson.id} — ${latestLesson.titleAr}):** ${latestLesson.takeaway}`,
        ]
      : []),
    ...(state.coach
      ? [
          `- **تقييم الخبير شاهين:** ${state.coach.score ?? '—'}/10 — ${state.coach.note || (state.coach.readyForAutonomy ? 'جاهز للاعتماد على النفس' : 'مستمر تحت التوجيه')}.`,
          ...(state.coach.guidance ? [`- **توجيه شاهين للدورة القادمة:** ${state.coach.guidance}`] : []),
        ]
      : ['- **تقييم الخبير شاهين:** بانتظار دورة بمحرك متصل.']),
    '',
    '## ٤) أولويات التحسين القادمة',
    '',
    ...(state.nextActions.length
      ? state.nextActions.map((action, index) => `${index + 1}. **[${action.severity}/${action.area}]** ${action.textAr}`)
      : ['1. لا توجد ملاحظات حرجة — الاستمرار في مراقبة الفهرسة وتحديث الخريطة.']),
    '',
  ];

  if (state.mediaReport) {
    lines.push(
      '## ٥) منشورات جاهزة للنشر من «المندوب الإعلامي»',
      '',
      `**${state.mediaReport.headline}**`,
      '',
      ...state.mediaReport.social.map((post, idx) => `${idx + 1}. ${post}`),
      '',
      `- [صفحة الملف الإعلامي وبطاقات المشاركة](${absoluteUrl('media/', siteUrl)})`,
      `- [كل أدوات معمل شام](${absoluteUrl('tools/', siteUrl)})`,
      '',
    );
  }

  return lines.join('\n');
}
