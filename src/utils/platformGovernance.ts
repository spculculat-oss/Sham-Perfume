// Planning only: no workflow, AI call, enforcement or permission changes.
import { DEPARTMENTS } from './shaheenOrg';

export const CHARTER = [
  'المالك يحدد الرؤية ويعتمد السياسات والميزانية ضمن القانون والعقود.',
  'كل تكليف له مسؤول وموعد ومعيار قبول وموارد واضحة.',
  'التأخير إشارة للمراجعة وليس دليلاً تلقائياً على التقصير.',
  'لا محاسبة دون قاعدة معلنة وأدلة وسماع الرد وحق الاستئناف.',
  'المحقق لا يفصل في القضية ولا ينظر استئنافها، وتُراجع تعارضات المصالح.',
  'النقد المهني والاختلاف المحترم ليسا مخالفة.',
  'الخصوصية أساس: أقل قدر من البيانات ولغرض محدد وبصلاحية معلنة.',
  'الدفاع رقمي ومصرح به فقط، ولا هجمات انتقامية أو تجسس.',
  'الذكاء الاصطناعي يقترح ويشرح؛ القرارات الحساسة تحتاج اعتماداً بشرياً.',
  'هذه حوكمة داخلية وليست دولة أو محكمة حكومية ولا تلغي الحقوق القانونية.',
] as const;

export const INSTITUTIONS = [
  { id: 'strategy', name: 'مجلس الاستراتيجية', mission: 'الرؤية والأهداف والسياسات والميزانية', existing: ['leadership'] },
  { id: 'operations', name: 'وزارة التشغيل والخدمات', mission: 'المهام ومعايير القبول وجودة الخدمة', existing: ['store', 'experience'] },
  { id: 'technology', name: 'وزارة التقنية والحماية', mission: 'التطوير والصلاحيات والدفاع الرقمي والتعافي', existing: ['reliability'] },
  { id: 'finance', name: 'وزارة المالية والموارد', mission: 'الميزانية والمشتريات وكفاءة الإنفاق', existing: [] },
  { id: 'education', name: 'وزارة التعليم والمعرفة', mission: 'الأكاديمية والمكتبة والتدريب وتوثيق المعرفة', existing: ['content'] },
  { id: 'media', name: 'وزارة الإعلام والتواصل', mission: 'التحديثات الدقيقة والدعم واتصال الأزمات', existing: ['content', 'experience'] },
  { id: 'justice', name: 'لجان العدالة والتظلمات', mission: 'استقبال الشكاوى والتحقيق والفصل والاستئناف بأدوار منفصلة', existing: [] },
  { id: 'advisory', name: 'مكتب المحامين والمستشارين', mission: 'مراجعة العقود والخصوصية والمخاطر بواسطة مختصين', existing: [] },
  { id: 'audit', name: 'هيئة الرقابة والتدقيق', mission: 'مراجعة الالتزام والصلاحيات ورفع تقارير مستقلة للمالك', existing: ['reliability'] },
] as const;
export type InstitutionId = typeof INSTITUTIONS[number]['id'];
export const existingDepartments = (id: InstitutionId) => {
  const unit = INSTITUTIONS.find((i) => i.id === id)!;
  return DEPARTMENTS.filter((d) => (unit.existing as readonly string[]).includes(d.id));
};
export const STATUS = { draft: 'مسودة', assigned: 'مكلّفة', active: 'قيد التنفيذ', blocked: 'متعطلة', review: 'بانتظار المراجعة', done: 'مكتملة' } as const;
export type TaskStatus = keyof typeof STATUS;
export interface GovernanceTask {
  id: string; title: string; institution: InstitutionId; responsible: string; due: string;
  acceptance: string; resources: string; status: TaskStatus; evidence: string;
}
export interface PlanningEvent { at: string; taskId: string; text: string }
export interface GovernancePlan { version: 1; tasks: GovernanceTask[]; events: PlanningEvent[] }
export const emptyPlan = (): GovernancePlan => ({ version: 1, tasks: [], events: [] });
const text = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
export function validateTask(task: GovernanceTask): void {
  if (!text(task.id, 100) || !text(task.title, 200) || !text(task.responsible, 120)
    || !text(task.acceptance, 1000) || !text(task.resources, 1000)
    || !INSTITUTIONS.some((i) => i.id === task.institution)
    || !Object.hasOwn(STATUS, task.status)
    || !/^\d{4}-\d{2}-\d{2}$/.test(task.due) || !Number.isFinite(Date.parse(task.due))
    || new Date(task.due).toISOString().slice(0, 10) !== task.due
    || typeof task.evidence !== 'string' || task.evidence.length > 2000) throw new Error('راجع الحقول المطلوبة وحدودها والتاريخ.');
  if (task.status === 'done' && !task.evidence.trim()) throw new Error('أضف دليل الإنجاز قبل إغلاق المهمة.');
  if (task.status === 'blocked' && !task.evidence.trim()) throw new Error('اكتب سبب التعطّل وخطوة المعالجة.');
}
const NEXT: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: ['assigned'], assigned: ['active', 'blocked'], active: ['blocked', 'review'],
  blocked: ['active'], review: ['active', 'done'], done: [],
};
export const nextStatuses = (status: TaskStatus) => NEXT[status];
export function addTask(plan: GovernancePlan, task: GovernanceTask, at: string): GovernancePlan {
  validateTask(task);
  if (task.status !== 'draft' || plan.tasks.some((t) => t.id === task.id)) throw new Error('المهمة الجديدة تبدأ كمسودة بمعرّف فريد.');
  if (plan.tasks.length >= 200) throw new Error('وصلت لحد مساحة التخطيط: صدّر السجل قبل بدء خطة جديدة.');
  return { ...plan, tasks: [...plan.tasks, task], events: [...plan.events, { at, taskId: task.id, text: 'إنشاء مسودة تكليف' }] };
}
export function transitionTask(plan: GovernancePlan, id: string, status: TaskStatus, evidence: string, at: string): GovernancePlan {
  const old = plan.tasks.find((t) => t.id === id);
  if (!old || !NEXT[old.status].includes(status)) throw new Error('انتقال غير مسموح في دورة المهمة.');
  const updated = { ...old, status, evidence: evidence.trim() };
  validateTask(updated);
  return { ...plan, tasks: plan.tasks.map((t) => t.id === id ? updated : t), events: [...plan.events, { at, taskId: id, text: `${STATUS[old.status]} ← ${STATUS[status]}` }] };
}
export function overdue(task: GovernanceTask, today: string): boolean {
  return task.status !== 'done' && task.due < today;
}
