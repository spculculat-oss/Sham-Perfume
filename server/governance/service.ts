import { randomUUID } from 'node:crypto';
import type { Store } from '../core/store';
import { ValidationError } from '../core/repository';
import { addTask, emptyPlan, transitionTask, type GovernancePlan, type GovernanceTask } from '../../src/utils/platformGovernance';

export interface GovernanceRevision { revision: number; plan: GovernancePlan; at: string; actor: 'owner' }

/** Immutable revisions use Store.create's cross-instance uniqueness (Postgres/Firestore). */
export class GovernanceService {
  constructor(private store: Store) {}
  private available() {
    if (!this.store.persistent || !['postgres', 'firestore'].includes(this.store.kind)) {
      throw new ValidationError('GOVERNANCE_STORAGE_REQUIRED', 'الحوكمة تحتاج تخزيناً مركزياً خاصاً: Postgres أو Firestore. لم يتم حفظ أي بيانات.', 503);
    }
  }
  async read(): Promise<GovernanceRevision> {
    this.available();
    const revisions = await this.store.list('governanceRevisions');
    return revisions.sort((a, b) => b.revision - a.revision)[0] || { revision: 0, plan: emptyPlan(), at: '', actor: 'owner' };
  }
  async command(input: unknown): Promise<GovernanceRevision> {
    this.available();
    const body = input as Record<string, unknown> | null;
    if (!body || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new ValidationError('INVALID_COMMAND', 'رقم نسخة السجل مطلوب.');
    const current = await this.read();
    if (body.revision !== current.revision) throw new ValidationError('REVISION_CONFLICT', 'السجل اتغير من جلسة أخرى. حدّث البيانات قبل المحاولة.', 409);
    if (current.plan.events.length >= 1000) throw new ValidationError('GOVERNANCE_CAPACITY', 'وصل السجل لحد المرحلة الأولية. يلزم أرشفة مُدارة قبل إضافة تغييرات جديدة.', 409);
    const at = new Date().toISOString();
    let plan: GovernancePlan;
    try {
      if (body.action === 'create') {
        const t = body.task as GovernanceTask | undefined;
        if (!t || typeof t !== 'object') throw new Error('بيانات المهمة مطلوبة.');
        // Whitelist fields: never accept client-provided identity, status, events or timestamps.
        plan = addTask(current.plan, { id: randomUUID(), title: t.title, responsible: t.responsible, institution: t.institution, due: t.due, acceptance: t.acceptance, resources: t.resources, evidence: '', status: 'draft' }, at);
      } else if (body.action === 'transition') {
        if (typeof body.id !== 'string' || typeof body.evidence !== 'string') throw new Error('بيانات الانتقال مطلوبة.');
        plan = transitionTask(current.plan, body.id, body.status as GovernanceTask['status'], body.evidence, at);
      } else throw new Error('أمر غير مسموح.');
    } catch (e) { throw new ValidationError('INVALID_COMMAND', e instanceof Error ? e.message : 'أمر غير صالح.'); }
    const next: GovernanceRevision = { revision: current.revision + 1, plan, at, actor: 'owner' };
    if (!await this.store.create('governanceRevisions', String(next.revision), next)) {
      throw new ValidationError('REVISION_CONFLICT', 'تم حفظ تغيير متزامن. حدّث البيانات قبل المحاولة.', 409);
    }
    return next;
  }
}
