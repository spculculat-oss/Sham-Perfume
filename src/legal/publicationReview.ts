/** Fail-closed editorial checklist, not legal advice or an approval service.
 * No browser form may grant publication rights. A trusted publishing service must
 * verify reviewer identity, permissions and evidence before using these records.
 */
export interface PublicationSource {
  id: string;
  citation: string;
  url: string;
  locator: string;
  accessedOn: string;
  rights: 'unknown' | 'open-license' | 'permission' | 'public-domain';
  rightsEvidence: string;
  permittedUse: string;
}
export interface PublicationReview {
  manuscriptVersion: string;
  sources: PublicationSource[];
  claims: Array<{
    id: string;
    text: string;
    sourceIds: string[];
    evidence: 'supported' | 'limited' | 'outdated' | 'conflicting' | 'unassessed';
    assessedOn: string;
    caveat: string;
  }>;
  approvals: Array<{
    role: 'scientific' | 'legal' | 'shaheen';
    version: string;
    reviewer: string;
    decision: 'approved' | 'changes-requested';
    evidenceRef: string;
  }>;
}
/** Check completeness only: never represents an actual reviewer decision. */
export function publicationBlockers(review: PublicationReview): string[] {
  const blockers: string[] = [];
  if (!review.manuscriptVersion.trim()) blockers.push('manuscript-version-missing');
  if (!review.sources.length) blockers.push('sources-missing');
  const ids = new Set(review.sources.map(s => s.id));
  if (ids.size !== review.sources.length || ids.has('')) blockers.push('source-ids-invalid');
  for (const s of review.sources) {
    if (!s.citation.trim() || !/^https?:\/\//.test(s.url) || !s.locator.trim() || !s.accessedOn.trim()) blockers.push(`source-incomplete:${s.id}`);
    if (s.rights === 'unknown' || !s.rightsEvidence.trim() || !s.permittedUse.trim()) blockers.push(`rights-unverified:${s.id}`);
  }
  if (!review.claims.length) blockers.push('claims-missing');
  const claimIds = new Set(review.claims.map(c => c.id));
  if (claimIds.size !== review.claims.length || claimIds.has('')) blockers.push('claim-ids-invalid');
  for (const c of review.claims) {
    if (!c.text.trim() || !c.assessedOn.trim() || c.evidence === 'unassessed' || !c.sourceIds.length || c.sourceIds.some(id => !ids.has(id))) blockers.push(`claim-unreviewed:${c.id}`);
    if (c.evidence !== 'supported' && !c.caveat.trim()) blockers.push(`claim-caveat-missing:${c.id}`);
  }
  for (const role of ['scientific', 'legal', 'shaheen'] as const) {
    const latest = review.approvals.filter(a => a.role === role && a.version === review.manuscriptVersion).at(-1);
    if (!latest || latest.decision !== 'approved' || !latest.reviewer.trim() || !latest.evidenceRef.trim()) blockers.push(`approval-required:${role}`);
  }
  return blockers;
}
