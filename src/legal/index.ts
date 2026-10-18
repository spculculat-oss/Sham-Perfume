/**
 * Sham Legal Expert — نقطة التصدير الرئيسية
 * استورد من هنا كل ما تحتاجه للفحص القانوني
 */

export * from './legalExpert';
export * from './jurisdictions';
export * from './complianceMatrix';

// دالة سريعة لشاهين: افحص المنصة واطبع الملخص
export async function runLegalAuditForShaheen(): Promise<void> {
  const { auditPlatform, generateShaheenReport } = await import('./legalExpert');
  const result = auditPlatform();
  console.log(generateShaheenReport(result));
  console.log(`\nنقاط الامتثال: ${result.complianceScore}/100`);
  console.log(`المشاكل الحرجة: ${result.bySeverity.critical} — يجب إصلاحها خلال 7 أيام`);
}
