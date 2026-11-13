/**
 * أنواع بوابة استقبال التحديثات — Sham Perfume Update Gateway types.
 *
 * كل تطوير قادم من أي منصة أخرى يصل أولاً إلى `updateGateway.ts` على شكل
 * «حزمة تطوير» (DevelopmentPackage): بيانات تصريحية قابلة للتحليل، وليست كوداً يُنفَّذ.
 * البوابة تقارن الحزمة بالموجود، تثبّت الزيادة فقط، وتحفظ بيانات المستخدمين.
 */

/** منصات التطوير المعروفة؛ أي منصة أخرى تُقبل كمعرّف نصي حر (بأحرف صغيرة). */
export type DevelopmentPlatform =
  | 'arena'
  | 'claude'
  | 'chatgpt'
  | 'gemini'
  | 'deepseek'
  | 'manus'
  | 'ai-studio'
  | 'github'
  | 'local'
  | 'manual'
  | (string & {});

/** نوع التطوير داخل الحزمة. */
export type DevelopmentItemKind = 'tool' | 'feature' | 'data' | 'content' | 'config';

/**
 * عنصر تطوير واحد: أداة أو ميزة أو مجموعة بيانات أو محتوى أو إعداد.
 * الحمولة (payload) بيانات تصريحية فقط — لا دوال ولا كود تنفيذي.
 */
export interface DevelopmentItem {
  /** معرّف ثابت للتطوير، مثل `tool.cost-calculator`. */
  id: string;
  kind: DevelopmentItemKind;
  /** رقم إصدار تصاعدي صحيح؛ الترقية تُقبل فقط إذا كان أكبر من المثبت. */
  version: number;
  titleAr: string;
  titleEn: string;
  /** تعريف التطوير (بيانات JSON). لا يجوز أن يمس أي مفتاح من مفاتيح بيانات المستخدمين. */
  payload: Record<string, unknown>;
  /** معرّفات تطويرات يجب أن تكون مثبتة قبل هذا العنصر. */
  requires?: string[];
  /** معرّف تطوير قديم يحل محله هذا العنصر عند التثبيت. */
  replaces?: string;
  /** ملفات المصدر المتأثرة (للتوثيق فقط، لا يتحقق منها وقت التشغيل). */
  files?: string[];
}

/** الحزمة الواردة من منصة أخرى — أول ما تراه البوابة. */
export interface DevelopmentPackage {
  schemaVersion: 1;
  /** معرّف فريد للحزمة من المنصة المصدر. */
  packageId: string;
  platform: DevelopmentPlatform;
  /** وقت الإنشاء عند المصدر بصيغة ISO، إن وُجد. */
  authoredAt?: string;
  noteAr?: string;
  noteEn?: string;
  items: DevelopmentItem[];
}

/** قرار البوابة على عنصر واحد. */
export type ItemDecision =
  /** عنصر جديد لم يكن موجوداً — هذه هي «الزيادة فقط» التي تُثبّت. */
  | 'applied'
  /** ترقية لعنصر مثبت بإصدار أحدث فعلاً. */
  | 'updated'
  /** موجود بنفس المحتوى — لا يحتاج تثبيتاً. */
  | 'unchanged'
  /** إصدار وارد أقدم من أو يساوي المثبت — يُتجاهل. */
  | 'stale'
  /** كان ملغىً قبل ذلك — يبقى ملغىً ولا يُثبّت مهما عاد. */
  | 'canceled'
  /** مرفوض: انتهاك بيانات المستخدمين أو صيغة غير صالحة أو تكرار داخل الحزمة. */
  | 'rejected'
  /** تبعياته غير متوفرة بعد — يُؤجل حتى تصل. */
  | 'deferred';

/** تقرير البوابة عن عنصر واحد. */
export interface ItemReport {
  id: string;
  titleAr: string;
  decision: ItemDecision;
  reasonAr: string;
  reasonEn: string;
  previousVersion?: number;
  appliedVersion?: number;
}

/** العنصر كما ثبت في سجل المثبتات. */
export interface InstalledItem {
  id: string;
  kind: DevelopmentItemKind;
  version: number;
  titleAr: string;
  titleEn: string;
  payload: Record<string, unknown>;
  requires?: string[];
  files?: string[];
  appliedAt: string;
  fromPlatform: string;
  fromPackageId: string;
}

/** قيد في سجل التحديثات المطبقة (اللِدجر). */
export interface LedgerEntry {
  packageId: string;
  platform: string;
  receivedAt: string;
  fingerprint: string;
  /** أُعيد استقبال حزمة بنفس المعرف ومحتوى منقح. */
  revision: boolean;
  counts: Record<ItemDecision, number>;
  noteAr?: string;
}

/** عنصر في سجل الملغيات: كل تطوير ألغيناه يُرفض تلقائياً إذا عاد من أي منصة. */
export interface CanceledItem {
  id: string;
  titleAr?: string;
  titleEn?: string;
  reasonAr?: string;
  reasonEn?: string;
  canceledAt: string;
  /** الحزمة التي كان العنصر قد وصل فيها قبل إلغائه. */
  fromPackageId?: string;
  /** كم مرة حاولت منصة أخرى إعادة إدخاله فرفضناه. */
  rejectedAttempts: number;
  lastAttemptAt?: string;
}

/** نتيجة استقبال حزمة كاملة. */
export interface UpdateReport {
  /** هل مرّت الحزمة الفحص وعولجت (حتى لو لم يُثبّت منها شيء)؟ */
  ok: boolean;
  dryRun: boolean;
  duplicate: boolean;
  packageId: string;
  platform: string;
  receivedAt: string;
  counts: Record<ItemDecision, number>;
  items: ItemReport[];
  /** لم تُلمس بيانات المستخدمين أثناء التطبيق (أ رُدت كما كانت). */
  userDataPreserved: boolean;
  userDataNotesAr: string[];
  /** سبب رفض الحزمة كلها إن رُفضت. */
  errorAr?: string;
  errorEn?: string;
}

/** نتيجة تحليل نص JSON وارد من بيئة خارجية. */
export type ParsePackageResult =
  | { ok: true; pkg: DevelopmentPackage }
  | { ok: false; errorAr: string; errorEn: string };
