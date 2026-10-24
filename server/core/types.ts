import type { FinanceOrder, FinanceSession, FinanceEntry, FinanceAttempt, FinanceIssue, PaymentRegistration, FinanceReport, FinanceReview, FinanceRun, CollectionAccount, DirectPayment, Payable, Budget, BankAudit } from '../finance/types';
/**
 * Sham Core — shared domain types.
 * Every entity is owned by Sham's own storage; no provider ever owns business data.
 */
import type { MemoryEntry } from '../../src/utils/shaheenMemory';
import type { SupportedLanguage } from '../../src/types/i18n';
import type { SeoState } from '../../src/seo/agentState';
import type { CensusReport } from '../../src/utils/platformCensus';
import type { InsightProfile } from '../../src/utils/visitorInsights';

export type Lang = SupportedLanguage;

export type ServiceKind =
  | 'info'            // platform tools, calculators, libraries
  | 'store'           // ready products, oils, raw materials
  | 'custom_order'    // bespoke perfume composition
  | 'b2b'             // wholesale, private label, factories
  | 'consultation'    // expert sessions
  | 'support'         // complaints, after-sales
  | 'custom';         // any future commercial service defined from admin

export interface FormField {
  name: string;
  labelAr: string;
  labelEn: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'email' | 'tel';
  required?: boolean;
  options?: string[];
}

export interface ServiceDef {
  id: string;
  kind: ServiceKind;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Words that route a visitor message to this service ("experts" router). */
  keywords: string[];
  enabled: boolean;
  /** Extra request fields the visitor fills; contact fields are always collected. */
  formFields: FormField[];
  /** Site tab opened by the assistant for info services. */
  siteTab?: string;
  order: number;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  category: 'perfume' | 'oil' | 'raw_material' | 'packaging' | 'kit' | 'other';
  price: number;
  currency: string;
  stock: number;
  unit: string;
  descriptionAr: string;
  descriptionEn: string;
  tags: string[];
  active: boolean;
  demo?: boolean;
  updatedAt: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
  serviceId?: string;
  updatedAt: string;
}

export interface TraceStep {
  stage: 'guard' | 'intent' | 'retrieve' | 'plan' | 'tool' | 'council' | 'engine' | 'compose';
  detail: string;
  ms?: number;
}

export interface ActionCard {
  type: 'request_form' | 'products' | 'order_status' | 'open_tab' | 'handoff' | 'privacy';
  serviceId?: string;
  title?: string;
  fields?: FormField[];
  products?: Pick<Product, 'id' | 'sku' | 'nameAr' | 'nameEn' | 'price' | 'currency' | 'stock' | 'unit'>[];
  request?: PublicRequestView;
  /** Prefilled reference for the tracking form. */
  ref?: string;
  tab?: string;
  /** privacy card: what the assistant remembers about this visitor. */
  memory?: Record<string, string>;
}

export interface Citation { id: string; title: string; kind: 'knowledge' | 'product' | 'service' }

export interface MessageFeedback { rating: 'up' | 'down'; reason?: string; at: string }

/** Visitor-safe progress step (the "thinking/steps" panel), localised, no internal scores. */
export interface PublicStep { stage: TraceStep['stage']; label: string }

export interface ConversationMessage {
  /** Stable id so visitors can rate a specific answer. Older messages may not have one. */
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  intent?: string;
  engine?: string;
  citations?: Citation[];
  actions?: ActionCard[];
  trace?: TraceStep[];
  steps?: PublicStep[];
  suggestions?: string[];
  feedback?: MessageFeedback;
  /** The visitor pressed "stop": `text` is exactly what they saw before stopping. */
  stopped?: boolean;
  /** Advisory council transcript (independent opinions → anonymous peer review → synthesis). */
  council?: CouncilTranscript;
}

export interface Conversation {
  id: string;
  visitorId: string;
  language: Lang;
  status: 'open' | 'handoff' | 'closed';
  serviceId?: string;
  messages: ConversationMessage[];
  /** Short visitor memory extracted from the conversation (preferences, last request ref). */
  memory: Record<string, string>;
  startedAt: string;
  updatedAt: string;
}

export type RequestType = 'order' | 'custom_formula' | 'b2b_quote' | 'consultation' | 'support' | 'service';
export type RequestStatus = 'new' | 'in_progress' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';

export interface OrderItem { productId: string; sku: string; name: string; quantity: number; unitPrice: number; currency: string }

export interface ServiceRequest {
  id: string;
  ref: string;
  type: RequestType;
  serviceId: string;
  status: RequestStatus;
  contact: { name: string; phone?: string; email?: string };
  fields: Record<string, string>;
  items?: OrderItem[];
  total?: number;
  currency?: string;
  conversationId?: string;
  visitorId?: string;
  notes: { at: string; text: string; by: 'admin' | 'system' }[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicRequestView {
  ref: string;
  type: RequestType;
  status: RequestStatus;
  serviceId: string;
  total?: number;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

/** Questions the assistant could not answer from Sham data, or answers visitors rated down. */
export interface KnowledgeGap {
  id: string;
  key: string;
  question: string;
  source: 'no_answer' | 'negative_feedback';
  count: number;
  status: 'open' | 'resolved' | 'ignored';
  lastAnswer?: string;
  reason?: string;
  conversationId?: string;
  resolvedDocId?: string;
  firstAt: string;
  lastAt: string;
}

/** Visitor-level memory shared across conversations (like assistant "memory"), deletable by the visitor. */
export interface VisitorProfile {
  id: string;
  memory: Record<string, string>;
  conversationIds: string[];
  firstSeen: string;
  lastSeen: string;
}

export type EngineId = 'self_hosted' | 'gemini' | 'openai' | 'claude' | 'deepseek' | 'openrouter' | 'perplexity' | 'sham_local';
export type ModelEngineId = Exclude<EngineId, 'sham_local'>;

/** Expert lens a council member argues from (the same model can sit twice with different lenses). */
export type CouncilRole = 'formulator' | 'commercial' | 'safety' | 'customer' | 'general';

export interface CouncilMember {
  id: string;
  engine: ModelEngineId;
  /** Optional model override, e.g. two Ollama models on one self-hosted server, or OpenRouter slugs. */
  model?: string;
  role: CouncilRole;
  enabled: boolean;
}

/** "Advisory council": several models answer independently, review each other anonymously, then a chair writes one consultative reply. */
export interface CouncilSettings {
  enabled: boolean;
  members: CouncilMember[];
  /** Chair that writes the final answer: a member id, or 'auto' (first member that answered, in engine-policy order). */
  chair: string;
  /** Peer-review rounds after the first opinions (0 = opinions + synthesis only). */
  rounds: number;
  /** Intents that convene the council automatically; visitors can also ask for it explicitly. */
  intents: string[];
  /** Let visitors read the discussion under the answer (admins always can). */
  showDiscussion: boolean;
}

export interface CouncilEntry {
  memberId: string;
  /** Anonymous label used during the review ("A", "B", …) so models judge content, not brands. */
  label: string;
  engine: ModelEngineId;
  model: string;
  role: CouncilRole;
  opinion?: string;
  reviews: string[];
  ok: boolean;
  ms: number;
}

export interface CouncilTranscript {
  entries: CouncilEntry[];
  rounds: number;
  chair?: { memberId: string; engine: ModelEngineId; model: string };
  /** 'synthesis' = chair wrote the answer; 'single' = only one opinion survived; 'failed' = fell back to the normal engine policy. */
  outcome: 'synthesis' | 'single' | 'failed';
  ms: number;
}

/**
 * Settings of «الخبير شاهين» (the perfume-design chat). Defaults live in server/config/shaheen.ts
 * (tracked in Git, so every deployment — Vercel and the API behind GitHub Pages — gets the same
 * baseline); the admin dashboard can override them when the store is persistent.
 */
export interface ShaheenSettings {
  /** Master switch: when off, the chat answers SHAHEEN_DISABLED and the UI explains it. */
  enabled: boolean;
  /** Engines Shaheen may use, in failover order for "auto". Unlisted engines are hidden from visitors. */
  engines: ModelEngineId[];
  /** Optional model id per engine (otherwise the server env / built-in default is used). */
  models: Partial<Record<ModelEngineId, string>>;
  temperature: number;
  /** Answer length budget per reply (tokens). */
  maxTokens: number;
  /** Extra admin instructions appended to the built-in safety prompt (cannot remove the safety rules). */
  instructions: string;
  /** Let visitors pick a specific engine; when off only "auto" is offered. */
  allowVisitorChoice: boolean;
}

export interface CoreSettings {
  assistantNameAr: string;
  assistantNameEn: string;
  welcomeAr: string;
  welcomeEn: string;
  personaAr: string;
  /** Ordered engine policy. `sham_local` is always appended as the guaranteed last step. */
  enginePolicy: EngineId[];
  temperature: number;
  council: CouncilSettings;
  shaheen: ShaheenSettings;
  currency: string;
  handoffContact: string;
  businessHours: string;
  /**
   * Version of the built-in knowledge seed already applied to this store (see server/core/seed.ts).
   * Older stores miss it, so they are upgraded once: new platform guides are added, edited docs kept.
   */
  knowledgeSeedVersion?: number;
  updatedAt: string;
}

export interface Collections {
  financeOrders: FinanceOrder;
  financeSessions: FinanceSession;
  financeEntries: FinanceEntry;
  financeAttempts: FinanceAttempt;
  financeIssues: FinanceIssue;
  paymentRegistrations: PaymentRegistration;
  financeReports: FinanceReport;
  financeReviews: FinanceReview;
  financeRuns: FinanceRun;
  bankAccounts: CollectionAccount;
  bankDirect: DirectPayment;
  bankPayables: Payable;
  bankBudgets: Budget;
  bankAudit: BankAudit;
  services: ServiceDef;
  products: Product;
  knowledge: KnowledgeDoc;
  conversations: Conversation;
  requests: ServiceRequest;
  settings: CoreSettings & { id: string };
  gaps: KnowledgeGap;
  visitors: VisitorProfile;
  /** «ذاكرة شاهين»: answers Shaheen gave, reused for repeated questions and when no AI engine answers. */
  memory: MemoryEntry;
  /** «منارة شاهين»: SEO/media agent state and learning history (one record: id 'state'). */
  seo: SeoState;
  /** «روبوت التعداد — دولة المنصة»: aggregated, privacy-safe platform visit ledger (one record: id 'state'). */
  census: CensusReport & { id: string };
  /** «خزنة فهم الزوار»: one behaviour profile per visitor who accepted «التحليل» — the administration's only (server/insights.ts). */
  insightProfiles: InsightProfile;
}
export type CollectionName = keyof Collections;
