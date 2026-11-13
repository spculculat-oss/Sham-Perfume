/**
 * Sham Legal Expert — Server Audit Endpoint
 * GET /api/legal/audit — يرد بنتيجة فحص الامتثال (للإدارة فقط)
 * يقرأ من src/legal/legalExpert.ts مباشرة (نفس مصدر الحقيقة)
 */

import type { Request, Response } from 'express';

// استيراد مباشر من src/legal — نفس المنطق في الواجهة والخادم
// يُستخدم في server.ts: app.get('/api/legal/audit', requireAuth, auditHandler)

export async function legalAuditHandler(_req: Request, res: Response) {
  // ديناميكي لتجنب مشاكل الاستيراد الدائري في الاختبارات
  const { auditPlatform, complianceStats } = await import('../../src/legal/legalExpert.js');
  const { JURISDICTIONS } = await import('../../src/legal/jurisdictions.js');

  const audit = auditPlatform();
  const stats = complianceStats();

  res.json({
    ok: true,
    auditedAt: audit.auditedAt,
    complianceScore: audit.complianceScore,
    stats,
    bySeverity: audit.bySeverity,
    byCategory: audit.byCategory,
    criticalIds: audit.criticalFindings.map((f) => f.id),
    totalFindings: audit.totalFindings,
    jurisdictions: Object.keys(JURISDICTIONS).length,
    disclaimer: 'تنبيه: هذا تحليل معلوماتي، لا يغني عن استشارة محامٍ مرخص.',
  });
}

export async function legalFindingsHandler(req: Request, res: Response) {
  const { LEGAL_FINDINGS } = await import('../../src/legal/legalExpert.js');
  const { id } = req.params as { id: string };
  const finding = LEGAL_FINDINGS.find((f) => f.id.toUpperCase() === id.toUpperCase());
  if (!finding) {
    res.status(404).json({ ok: false, error: 'FINDING_NOT_FOUND' });
    return;
  }
  res.json({ ok: true, finding });
}
