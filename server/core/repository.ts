/**
 * Repository: all business rules that touch data live here, independent of any AI engine.
 * Prices, stock and order totals are always computed on the server from the catalog.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { Store } from './store';
import type {
  Conversation, CoreSettings, KnowledgeDoc, KnowledgeGap, OrderItem, Product, PublicRequestView, RequestStatus,
  RequestType, ServiceDef, ServiceRequest, VisitorProfile,
} from './types';
import { defaultKnowledge, defaultServices, defaultSettings, demoProducts } from './seed';
import { CouncilConfigError, defaultCouncil, normalizeCouncil } from './council';
import { ShaheenConfigError, normalizeShaheen, withShaheenDefaults } from '../config/shaheen';
import { Bm25Index, tokenize, type IndexedDoc } from './text';
import { stripIntro } from './router';

export class ValidationError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STATUSES: RequestStatus[] = ['new', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled'];
const TYPE_BY_KIND: Record<ServiceDef['kind'], RequestType> = {
  info: 'service', store: 'order', custom_order: 'custom_formula', b2b: 'b2b_quote',
  consultation: 'consultation', support: 'support', custom: 'service',
};

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
export const normalizePhone = (value: string) => value.replace(/[^\d]/g, '').replace(/^00/, '');
const isEmail = (value: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(value);

export function publicView(request: ServiceRequest): PublicRequestView {
  const { ref, type, status, serviceId, total, currency, createdAt, updatedAt } = request;
  return { ref, type, status, serviceId, total, currency, createdAt, updatedAt };
}

export class Repository {
  private seeded?: Promise<void>;
  private index?: { key: string; bm25: Bm25Index };

  constructor(public store: Store, private env: Record<string, string | undefined> = process.env) {}

  /** Seeds defaults once per store (idempotent: existing admin edits are never overwritten). */
  ready(): Promise<void> {
    this.seeded ||= (async () => {
      if (!(await this.store.get('settings', 'core'))) {
        // Shaheen settings are not copied into the store: until an admin overrides them they follow
        // server/config/shaheen.ts, so a change there reaches every deployment on the next deploy.
        const { shaheen: _fileDefaults, ...seed } = defaultSettings();
        await this.store.put('settings', 'core', seed as CoreSettings & { id: string });
        if (!(await this.store.list('services')).length) for (const s of defaultServices()) await this.store.put('services', s.id, s);
        if (!(await this.store.list('knowledge')).length) for (const k of defaultKnowledge()) await this.store.put('knowledge', k.id, k);
        if (this.env.SHAM_SEED_DEMO === 'true' && !(await this.store.list('products')).length) {
          for (const p of demoProducts()) await this.store.put('products', p.id, p);
        }
      }
    })().catch((error) => { this.seeded = undefined; throw error; });
    return this.seeded;
  }

  // ---------- settings ----------
  async settings(): Promise<CoreSettings> {
    await this.ready();
    const stored = await this.store.get('settings', 'core');
    // Settings saved before a feature existed get its defaults (e.g. the advisory council).
    return stored
      ? { ...stored, council: stored.council || defaultCouncil(), shaheen: withShaheenDefaults(stored.shaheen) }
      : defaultSettings();
  }

  /** 'admin' when the dashboard overrides Shaheen, 'file' when it follows server/config/shaheen.ts. */
  async shaheenSource(): Promise<'admin' | 'file'> {
    await this.ready();
    return (await this.store.get('settings', 'core'))?.shaheen ? 'admin' : 'file';
  }
  async updateSettings(patch: Partial<CoreSettings>): Promise<CoreSettings> {
    const current = await this.settings();
    const allowedEngines = ['self_hosted', 'gemini', 'openai', 'claude', 'deepseek', 'openrouter', 'sham_local'];
    const next = { ...current, id: 'core' } as CoreSettings & { id: string };
    for (const key of ['assistantNameAr', 'assistantNameEn', 'welcomeAr', 'welcomeEn', 'personaAr', 'currency', 'handoffContact', 'businessHours'] as const) {
      if (patch[key] !== undefined) next[key] = str(patch[key], key.startsWith('welcome') || key === 'personaAr' ? 1200 : 200);
    }
    if (patch.temperature !== undefined) {
      const t = Number(patch.temperature);
      if (!Number.isFinite(t) || t < 0 || t > 1) throw new ValidationError('INVALID_TEMPERATURE', 'Temperature must be between 0 and 1');
      next.temperature = t;
    }
    if (patch.enginePolicy !== undefined) {
      if (!Array.isArray(patch.enginePolicy) || patch.enginePolicy.some((e) => !allowedEngines.includes(e))) {
        throw new ValidationError('INVALID_POLICY', 'Unknown engine in policy');
      }
      next.enginePolicy = [...new Set(patch.enginePolicy)];
    }
    if (patch.council !== undefined) {
      try { next.council = normalizeCouncil(patch.council, current.council); } catch (error) {
        if (error instanceof CouncilConfigError) throw new ValidationError('INVALID_COUNCIL', error.message);
        throw error;
      }
    }
    // Shaheen: null = go back to the shared file defaults. An unchanged copy (the dashboard always
    // sends the whole form) must not freeze today's file values into the store.
    const storedShaheen = (await this.store.get('settings', 'core'))?.shaheen;
    const { shaheen: _effective, ...rest } = next;
    let shaheenOverride = storedShaheen;
    if ((patch as { shaheen?: unknown }).shaheen === null) shaheenOverride = undefined;
    else if (patch.shaheen !== undefined) {
      let normalized;
      try { normalized = normalizeShaheen(patch.shaheen, current.shaheen); } catch (error) {
        if (error instanceof ShaheenConfigError) throw new ValidationError('INVALID_SHAHEEN', error.message);
        throw error;
      }
      // Same as server/config/shaheen.ts → follow the file again; unchanged → keep what was stored.
      if (JSON.stringify(normalized) === JSON.stringify(withShaheenDefaults(undefined))) shaheenOverride = undefined;
      else if (JSON.stringify(normalized) !== JSON.stringify(current.shaheen)) shaheenOverride = normalized;
    }
    const saved = { ...rest, updatedAt: new Date().toISOString(), ...(shaheenOverride ? { shaheen: shaheenOverride } : {}) };
    await this.store.put('settings', 'core', saved as CoreSettings & { id: string });
    return { ...saved, shaheen: withShaheenDefaults(shaheenOverride) };
  }

  // ---------- services ----------
  async services(includeDisabled = false): Promise<ServiceDef[]> {
    await this.ready();
    const all = (await this.store.list('services')).sort((a, b) => a.order - b.order);
    return includeDisabled ? all : all.filter((s) => s.enabled);
  }
  async saveService(input: Partial<ServiceDef>, id?: string): Promise<ServiceDef> {
    await this.ready();
    const existing = id ? await this.store.get('services', id) : undefined;
    if (id && !existing) throw new ValidationError('NOT_FOUND', 'Service not found', 404);
    const kinds: ServiceDef['kind'][] = ['info', 'store', 'custom_order', 'b2b', 'consultation', 'support', 'custom'];
    const service: ServiceDef = {
      id: existing?.id || this.slug(input.id || input.nameEn || 'service'),
      kind: kinds.includes(input.kind as ServiceDef['kind']) ? input.kind as ServiceDef['kind'] : existing?.kind || 'custom',
      nameAr: str(input.nameAr ?? existing?.nameAr, 120),
      nameEn: str(input.nameEn ?? existing?.nameEn, 120),
      descriptionAr: str(input.descriptionAr ?? existing?.descriptionAr, 1000),
      descriptionEn: str(input.descriptionEn ?? existing?.descriptionEn, 1000),
      keywords: (Array.isArray(input.keywords) ? input.keywords : existing?.keywords || []).map((k) => str(k, 60)).filter(Boolean).slice(0, 60),
      enabled: typeof input.enabled === 'boolean' ? input.enabled : existing?.enabled ?? true,
      formFields: Array.isArray(input.formFields) ? input.formFields.slice(0, 15).map((f) => ({
        name: this.slug(f.name || 'field').replace(/-/g, '_'),
        labelAr: str(f.labelAr, 120), labelEn: str(f.labelEn, 120),
        type: ['text', 'textarea', 'number', 'select', 'email', 'tel'].includes(f.type) ? f.type : 'text',
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options.map((o) => str(o, 60)).filter(Boolean).slice(0, 20) : undefined,
      })) : existing?.formFields || [],
      siteTab: str(input.siteTab ?? existing?.siteTab, 60) || undefined,
      order: Number.isFinite(Number(input.order)) ? Number(input.order) : existing?.order ?? 99,
      updatedAt: new Date().toISOString(),
    };
    if (!service.nameAr && !service.nameEn) throw new ValidationError('INVALID_SERVICE', 'Service name is required');
    if (!existing && await this.store.get('services', service.id)) service.id = `${service.id}-${randomBytes(2).toString('hex')}`;
    await this.store.put('services', service.id, service);
    this.index = undefined;
    return service;
  }

  // ---------- products ----------
  async products(includeInactive = false): Promise<Product[]> {
    await this.ready();
    const all = await this.store.list('products');
    return includeInactive ? all : all.filter((p) => p.active);
  }
  async saveProduct(input: Partial<Product>, id?: string): Promise<Product> {
    await this.ready();
    const settings = await this.settings();
    const existing = id ? await this.store.get('products', id) : undefined;
    if (id && !existing) throw new ValidationError('NOT_FOUND', 'Product not found', 404);
    const price = Number(input.price ?? existing?.price);
    const stock = Number(input.stock ?? existing?.stock ?? 0);
    if (!Number.isFinite(price) || price < 0) throw new ValidationError('INVALID_PRICE', 'Price must be a non-negative number');
    if (!Number.isInteger(stock) || stock < 0) throw new ValidationError('INVALID_STOCK', 'Stock must be a non-negative integer');
    const categories: Product['category'][] = ['perfume', 'oil', 'raw_material', 'packaging', 'kit', 'other'];
    const product: Product = {
      id: existing?.id || randomUUID(),
      sku: str(input.sku ?? existing?.sku, 60) || `SKU-${randomBytes(3).toString('hex').toUpperCase()}`,
      nameAr: str(input.nameAr ?? existing?.nameAr, 160),
      nameEn: str(input.nameEn ?? existing?.nameEn, 160),
      category: categories.includes(input.category as Product['category']) ? input.category as Product['category'] : existing?.category || 'other',
      price: Math.round(price * 100) / 100,
      currency: str(input.currency ?? existing?.currency, 8).toUpperCase() || settings.currency,
      stock,
      unit: str(input.unit ?? existing?.unit, 30) || 'piece',
      descriptionAr: str(input.descriptionAr ?? existing?.descriptionAr, 2000),
      descriptionEn: str(input.descriptionEn ?? existing?.descriptionEn, 2000),
      tags: (Array.isArray(input.tags) ? input.tags : existing?.tags || []).map((t) => str(t, 40)).filter(Boolean).slice(0, 30),
      active: typeof input.active === 'boolean' ? input.active : existing?.active ?? true,
      demo: existing?.demo && input.demo !== false ? true : undefined,
      updatedAt: new Date().toISOString(),
    };
    if (!product.nameAr && !product.nameEn) throw new ValidationError('INVALID_PRODUCT', 'Product name is required');
    await this.store.put('products', product.id, product);
    this.index = undefined;
    return product;
  }

  // ---------- knowledge ----------
  async knowledge(): Promise<KnowledgeDoc[]> {
    await this.ready();
    return this.store.list('knowledge');
  }
  async saveKnowledge(input: Partial<KnowledgeDoc>, id?: string): Promise<KnowledgeDoc> {
    await this.ready();
    const existing = id ? await this.store.get('knowledge', id) : undefined;
    if (id && !existing) throw new ValidationError('NOT_FOUND', 'Document not found', 404);
    const doc: KnowledgeDoc = {
      id: existing?.id || `kb-${randomUUID().slice(0, 8)}`,
      title: str(input.title ?? existing?.title, 200),
      content: str(input.content ?? existing?.content, 20000),
      tags: (Array.isArray(input.tags) ? input.tags : existing?.tags || []).map((t) => str(t, 40)).filter(Boolean).slice(0, 30),
      serviceId: str(input.serviceId ?? existing?.serviceId, 80) || undefined,
      updatedAt: new Date().toISOString(),
    };
    if (!doc.title || !doc.content) throw new ValidationError('INVALID_DOCUMENT', 'Title and content are required');
    await this.store.put('knowledge', doc.id, doc);
    this.index = undefined;
    return doc;
  }

  async remove(collection: 'services' | 'products' | 'knowledge', id: string) {
    await this.ready();
    const removed = await this.store.delete(collection, id);
    if (!removed) throw new ValidationError('NOT_FOUND', 'Item not found', 404);
    this.index = undefined;
  }

  /** Unified retrieval index over knowledge, enabled services and active products. */
  async searchIndex(): Promise<Bm25Index> {
    const [docs, services, products] = await Promise.all([this.knowledge(), this.services(), this.products()]);
    const key = JSON.stringify([docs.map((d) => d.updatedAt + d.id), services.map((s) => s.updatedAt + s.id), products.map((p) => p.updatedAt + p.id)]);
    if (this.index?.key === key) return this.index.bm25;
    const indexed: IndexedDoc[] = [
      ...docs.map((d) => ({ id: d.id, title: d.title, text: `${d.content} ${d.tags.join(' ')}`, kind: 'knowledge' as const })),
      ...services.map((s) => ({ id: s.id, title: s.nameAr, text: `${s.nameEn} ${s.descriptionAr} ${s.descriptionEn} ${s.keywords.join(' ')}`, kind: 'service' as const })),
      ...products.map((p) => ({ id: p.id, title: p.nameAr || p.nameEn, text: `${p.nameEn} ${p.sku} ${p.category} ${p.descriptionAr} ${p.descriptionEn} ${p.tags.join(' ')}`, kind: 'product' as const })),
    ];
    this.index = { key, bm25: new Bm25Index(indexed) };
    return this.index.bm25;
  }

  // ---------- conversations ----------
  async conversation(id: string) { await this.ready(); return this.store.get('conversations', id); }
  async conversations() { await this.ready(); return this.store.list('conversations'); }
  async saveConversation(conversation: Conversation) {
    // Bounded history keeps storage documents small (Firestore limit is 1 MiB).
    if (conversation.messages.length > 200) conversation.messages = conversation.messages.slice(-200);
    await this.store.put('conversations', conversation.id, conversation);
  }

  // ---------- visitor memory ----------
  async visitor(id: string): Promise<VisitorProfile | undefined> { await this.ready(); return this.store.get('visitors', id); }

  /** Upserts visitor memory and links the conversation, so memory follows the visitor to new chats. */
  async touchVisitor(id: string, conversationId: string, memory: Record<string, string>): Promise<VisitorProfile> {
    const t = new Date().toISOString();
    const existing = await this.store.get('visitors', id);
    const profile: VisitorProfile = existing || { id, memory: {}, conversationIds: [], firstSeen: t, lastSeen: t };
    profile.memory = { ...profile.memory, ...memory };
    if (!profile.conversationIds.includes(conversationId)) profile.conversationIds = [...profile.conversationIds, conversationId].slice(-100);
    profile.lastSeen = t;
    await this.store.put('visitors', id, profile);
    return profile;
  }

  /** "Forget me": removes the visitor profile and all of their conversations. Business requests are kept. */
  async deleteVisitorData(id: string): Promise<{ conversations: number }> {
    await this.ready();
    const profile = await this.store.get('visitors', id);
    let conversations = 0;
    for (const conversationId of profile?.conversationIds || []) {
      const conversation = await this.store.get('conversations', conversationId);
      if (conversation?.visitorId === id && await this.store.delete('conversations', conversationId)) conversations++;
    }
    if (profile) await this.store.delete('visitors', id);
    return { conversations };
  }

  // ---------- feedback & knowledge gaps (learning loop) ----------
  async setFeedback(input: { conversationId?: unknown; visitorId?: unknown; messageId?: unknown; rating?: unknown; reason?: unknown }) {
    await this.ready();
    if (input.rating !== 'up' && input.rating !== 'down') throw new ValidationError('INVALID_RATING', 'Rating must be up or down');
    const conversation = typeof input.conversationId === 'string' ? await this.store.get('conversations', input.conversationId) : undefined;
    if (!conversation || conversation.visitorId !== input.visitorId) throw new ValidationError('NOT_FOUND', 'Conversation not found', 404);
    const index = conversation.messages.findIndex((m) => m.id && m.id === input.messageId && m.role === 'assistant');
    if (index < 0) throw new ValidationError('NOT_FOUND', 'Message not found', 404);
    const message = conversation.messages[index];
    const reason = str(input.reason, 500) || undefined;
    const previous = message.feedback?.rating;
    message.feedback = { rating: input.rating, reason, at: new Date().toISOString() };
    await this.saveConversation(conversation);
    if (input.rating === 'down' && previous !== 'down') {
      const question = [...conversation.messages.slice(0, index)].reverse().find((m) => m.role === 'user')?.text;
      if (question) await this.recordGap({ question: stripIntro(question) || question, source: 'negative_feedback', lastAnswer: message.text, reason, conversationId: conversation.id });
    }
    return message.feedback;
  }

  async recordGap(input: { question: string; source: KnowledgeGap['source']; lastAnswer?: string; reason?: string; conversationId?: string }) {
    const tokens = [...new Set(tokenize(input.question))].sort();
    if (!tokens.length) return undefined;
    const key = `${input.source}:${tokens.join(' ')}`;
    const t = new Date().toISOString();
    const gaps = await this.store.list('gaps');
    const existing = gaps.find((g) => g.key === key && g.status === 'open');
    const gap: KnowledgeGap = existing
      ? { ...existing, count: existing.count + 1, lastAt: t, lastAnswer: input.lastAnswer?.slice(0, 2000) ?? existing.lastAnswer, reason: input.reason || existing.reason, conversationId: input.conversationId || existing.conversationId }
      : { id: randomUUID(), key, question: input.question.slice(0, 500), source: input.source, count: 1, status: 'open', lastAnswer: input.lastAnswer?.slice(0, 2000), reason: input.reason, conversationId: input.conversationId, firstAt: t, lastAt: t };
    await this.store.put('gaps', gap.id, gap);
    return gap;
  }

  async gaps() { await this.ready(); return this.store.list('gaps'); }

  /** Closing the loop: the admin's answer becomes a knowledge document the assistant cites next time. */
  async resolveGap(id: string, input: { status?: unknown; title?: unknown; content?: unknown }) {
    await this.ready();
    const gap = await this.store.get('gaps', id);
    if (!gap) throw new ValidationError('NOT_FOUND', 'Gap not found', 404);
    if (input.status === 'ignored' || input.status === 'open') {
      gap.status = input.status;
    } else {
      const doc = await this.saveKnowledge({ title: str(input.title, 200) || gap.question, content: str(input.content, 20000), tags: ['from-gap'] });
      gap.status = 'resolved';
      gap.resolvedDocId = doc.id;
    }
    gap.lastAt = new Date().toISOString();
    await this.store.put('gaps', gap.id, gap);
    return gap;
  }

  // ---------- requests (orders, quotes, tickets) ----------
  async requests() { await this.ready(); return this.store.list('requests'); }

  async createRequest(body: unknown): Promise<ServiceRequest> {
    await this.ready();
    if (!body || typeof body !== 'object') throw new ValidationError('INVALID_REQUEST', 'JSON object required');
    const input = body as Record<string, unknown>;
    const service = (await this.services()).find((s) => s.id === input.serviceId);
    if (!service) throw new ValidationError('INVALID_SERVICE', 'Unknown or disabled service');
    if (service.kind === 'info') throw new ValidationError('INVALID_SERVICE', 'This service does not accept requests');

    const contactInput = (input.contact && typeof input.contact === 'object' ? input.contact : {}) as Record<string, unknown>;
    const contact = { name: str(contactInput.name, 120), phone: str(contactInput.phone, 40) || undefined, email: str(contactInput.email, 200).toLowerCase() || undefined };
    if (!contact.name) throw new ValidationError('INVALID_CONTACT', 'Name is required');
    if (!contact.phone && !contact.email) throw new ValidationError('INVALID_CONTACT', 'Phone or email is required');
    if (contact.phone && normalizePhone(contact.phone).length < 7) throw new ValidationError('INVALID_CONTACT', 'Invalid phone number');
    if (contact.email && !isEmail(contact.email)) throw new ValidationError('INVALID_CONTACT', 'Invalid email');

    const rawFields = (input.fields && typeof input.fields === 'object' ? input.fields : {}) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const field of service.formFields) {
      const value = str(rawFields[field.name], field.type === 'textarea' ? 3000 : 300);
      if (field.required && !value) throw new ValidationError('MISSING_FIELD', `Field ${field.name} is required`);
      if (value && field.type === 'number' && !Number.isFinite(Number(value))) throw new ValidationError('INVALID_FIELD', `Field ${field.name} must be a number`);
      if (value && field.type === 'select' && field.options?.length && !field.options.includes(value)) throw new ValidationError('INVALID_FIELD', `Invalid option for ${field.name}`);
      if (value) fields[field.name] = value;
    }

    let items: OrderItem[] | undefined;
    let total: number | undefined;
    let currency: string | undefined;
    if (service.kind === 'store') {
      const rawItems = Array.isArray(input.items) ? input.items.slice(0, 30) : [];
      if (!rawItems.length) throw new ValidationError('EMPTY_ORDER', 'Select at least one product');
      const catalog = new Map((await this.products()).map((p) => [p.id, p]));
      const merged = new Map<string, number>();
      for (const raw of rawItems as { productId?: unknown; quantity?: unknown }[]) {
        const quantity = Number(raw?.quantity);
        if (typeof raw?.productId !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
          throw new ValidationError('INVALID_ITEM', 'Invalid product or quantity');
        }
        merged.set(raw.productId, (merged.get(raw.productId) || 0) + quantity);
      }
      items = [...merged].map(([productId, quantity]) => {
        const product = catalog.get(productId);
        if (!product) throw new ValidationError('INVALID_ITEM', 'Product is not available');
        if (product.stock < quantity) throw new ValidationError('OUT_OF_STOCK', `Insufficient stock for ${product.sku}`, 409);
        return { productId, sku: product.sku, name: product.nameAr || product.nameEn, quantity, unitPrice: product.price, currency: product.currency };
      });
      const currencies = new Set(items.map((i) => i.currency));
      if (currencies.size > 1) throw new ValidationError('MIXED_CURRENCY', 'Products in one order must share a currency');
      currency = items[0].currency;
      total = Math.round(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) * 100) / 100;
      // Reserve stock at request time; admin cancellation releases it.
      for (const item of items) {
        const product = catalog.get(item.productId)!;
        await this.store.put('products', product.id, { ...product, stock: product.stock - item.quantity, updatedAt: new Date().toISOString() });
      }
      this.index = undefined;
    }

    const existingRefs = new Set((await this.requests()).map((r) => r.ref));
    let ref = '';
    do ref = `SH-${Array.from(randomBytes(6), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('')}`; while (existingRefs.has(ref));

    const t = new Date().toISOString();
    const request: ServiceRequest = {
      id: randomUUID(), ref, type: TYPE_BY_KIND[service.kind], serviceId: service.id, status: 'new', contact, fields,
      items, total, currency,
      conversationId: str(input.conversationId, 80) || undefined,
      visitorId: str(input.visitorId, 80) || undefined,
      notes: [{ at: t, text: 'Created by visitor via Sham Assistant', by: 'system' }],
      createdAt: t, updatedAt: t,
    };
    await this.store.put('requests', request.id, request);
    return request;
  }

  /** Tracking requires the reference AND the phone/email used, so refs alone never leak data. */
  async trackRequest(refInput: unknown, contactInput: unknown): Promise<ServiceRequest | undefined> {
    const ref = str(refInput, 20).toUpperCase();
    const contact = str(contactInput, 200).toLowerCase();
    if (!/^SH-[A-Z0-9]{6}$/.test(ref) || !contact) return undefined;
    const request = (await this.requests()).find((r) => r.ref === ref);
    if (!request) return undefined;
    const phoneOk = request.contact.phone && normalizePhone(contact).length >= 7 && normalizePhone(request.contact.phone).endsWith(normalizePhone(contact).slice(-9));
    const emailOk = request.contact.email && request.contact.email === contact;
    return phoneOk || emailOk ? request : undefined;
  }

  async updateRequest(id: string, patch: { status?: unknown; note?: unknown }): Promise<ServiceRequest> {
    await this.ready();
    const request = await this.store.get('requests', id);
    if (!request) throw new ValidationError('NOT_FOUND', 'Request not found', 404);
    const t = new Date().toISOString();
    if (patch.status !== undefined) {
      if (!STATUSES.includes(patch.status as RequestStatus)) throw new ValidationError('INVALID_STATUS', 'Unknown status');
      const next = patch.status as RequestStatus;
      if (next !== request.status) {
        if (request.status === 'cancelled') throw new ValidationError('INVALID_STATUS', 'Cancelled requests cannot be reopened');
        if (next === 'cancelled' && request.items) {
          for (const item of request.items) {
            const product = await this.store.get('products', item.productId);
            if (product) await this.store.put('products', product.id, { ...product, stock: product.stock + item.quantity, updatedAt: t });
          }
          this.index = undefined;
        }
        request.notes.push({ at: t, text: `Status: ${request.status} → ${next}`, by: 'system' });
        request.status = next;
      }
    }
    const note = str(patch.note, 2000);
    if (note) request.notes.push({ at: t, text: note, by: 'admin' });
    request.updatedAt = t;
    await this.store.put('requests', request.id, request);
    return request;
  }

  private slug(value: string) {
    return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || `item-${randomBytes(3).toString('hex')}`;
  }
}
