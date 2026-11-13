/** Requested coordination, not a completed meeting or an approval. Update only
 * against a documented reviewer decision; comments alone are not trusted approval.
 */
export const LIBRARY_REVIEW_HANDOFF = {
  id: 'library-editorial-review',
  issue: 203,
  url: 'https://github.com/spculculat-oss/Sham-Perfume/issues/203',
  status: 'awaiting-review' as 'awaiting-review' | 'completed',
  owner: 'shaheen',
  reviewer: 'legal',
  merchantAuthorization: 'publish-after-documented-approvals-and-presentation-changes',
};
export function libraryReviewBriefing(): string[] {
  if (LIBRARY_REVIEW_HANDOFF.status === 'completed') return [];
  return [
    `إخطار أمين المكتبة إلى شاهين — المهمة #${LIBRARY_REVIEW_HANDOFF.issue}: ${LIBRARY_REVIEW_HANDOFF.url}. فهرس 16 مرجعاً وخطط 3 كتب أصلية؛ لا مخطوطات أو مراجعات علمية مكتملة ولا موافقات قانونية حتى الآن.`,
    'مطلوب من شاهين: تنسيق مراجعة المدير القانوني مع أمين المكتبة ووكيل البرمجة، وتوثيق مناقشة الحقوق ومقترحات العرض في المهمة. التاجر فوّض النشر بعد تنفيذ المقترحات واعتماد النسخة قانونياً وعلمياً ومن شاهين؛ لا تنشر بمجرد تعليق approved ولا تعتبر هذا الإخطار موافقة أو مناقشة منجزة.',
  ];
}
