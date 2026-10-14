/**
 * Sham Core — shared domain types.
 * Every entity is owned by Sham's own storage; no provider ever owns business data.
 */
import type { SupportedLanguage } from '../../src/types/i18n';

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
  stage: 'guard' | 'intent' | 'retrieve' | 'plan' | 'tool' | 'engine' | 'compose';
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

export type EngineId = 'self_hosted' | 'gemini' | 'openai' | 'claude' | 'deepseek' | 'sham_local';

export interface CoreSettings {
  assistantNameAr: string;
  assistantNameEn: string;
  welcomeAr: string;
  welcomeEn: string;
  personaAr: string;
  /** Ordered engine policy. `sham_local` is always appended as the guaranteed last step. */
  enginePolicy: EngineId[];
  temperature: number;
  currency: string;
  handoffContact: string;
  businessHours: string;
  updatedAt: string;
}

export interface Collections {
  services: ServiceDef;
  products: Product;
  knowledge: KnowledgeDoc;
  conversations: Conversation;
  requests: ServiceRequest;
  settings: CoreSettings & { id: string };
  gaps: KnowledgeGap;
  visitors: VisitorProfile;
}
export type CollectionName = keyof Collections;
