/**
 * «مجتمع شام» — accounts, the merchants' portal, the users' portal (recipes, learning, orders).
 * Social (posts, friends, notifications) lives in social.ts, the messenger in messenger.ts, the
 * administration in admin.ts. Every module receives the same context: the database and the vault.
 */
import { BUNDLED_FX, convert, isCountry, tidy, type FxTable } from '../../src/utils/pricing';
import type { Row, Sql } from './db';
import { hashPassword, newId, newToken, tokenHash, verifyPassword, type Vault } from './crypto';

export interface Ctx { sql: Sql; vault: Vault; fx?: () => Promise<FxTable>; now?: () => Date }

export class CommunityError extends Error {
  constructor(public status: number, public code: string, message = code) { super(message); }
}
export const fail = (status: number, code: string, message?: string): never => { throw new CommunityError(status, code, message); };

/* ------------------------------------------ validation ------------------------------------------ */

export const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');
export function required(value: unknown, field: string, min: number, max: number): string {
  const text = clean(value, max);
  if (text.length < min) fail(400, 'INVALID_FIELD', field);
  return text;
}
export const isEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(v);
const IMAGE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const AUDIO = /^data:audio\/(webm|ogg|mp4|mpeg|aac|wav)(;codecs=[\w.]+)?;base64,[A-Za-z0-9+/=]+$/;
const HTTPS_IMAGE = /^https:\/\/[^\s"'<>]{8,600}$/;
/** A picture sent by the browser (already resized there): a base64 data URL up to `maxKb`. */
export function image(value: unknown, maxKb = 450, allowUrl = false): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (allowUrl && HTTPS_IMAGE.test(text)) return text;
  if (!IMAGE.test(text) || text.length > maxKb * 1370) fail(400, 'INVALID_IMAGE');
  return text;
}
export function audio(value: unknown, maxKb = 1200): string {
  const text = String(value || '');
  if (!AUDIO.test(text) || text.length > maxKb * 1370) fail(400, 'INVALID_AUDIO');
  return text;
}
const CRAFT = ['hobbyist', 'perfumer', 'master_lab'];
const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/* ------------------------------------------- shapes ------------------------------------------- */

export interface PublicUser {
  id: string; handle: string; name: string; avatar: string | null; bio: string; country: string;
  craftLevel: string; role: string; merchant?: { slug: string; storeName: string } | null; online: boolean; lastSeen: string;
}
const ONLINE_MS = 2 * 60_000;
export function publicUser(row: Row): PublicUser {
  const lastSeen = new Date(row.last_seen || row.created_at || Date.now());
  return {
    id: row.id, handle: row.handle, name: row.name, avatar: row.avatar || null, bio: row.bio || '', country: row.country || '',
    craftLevel: row.craft_level || 'hobbyist', role: row.role,
    merchant: row.m_slug && row.m_status === 'approved' ? { slug: row.m_slug, storeName: row.m_store } : null,
    online: Date.now() - lastSeen.getTime() < ONLINE_MS, lastSeen: lastSeen.toISOString(),
  };
}
/** SELECT list for a user + their approved store (alias u, merchants m). */
export const USER_COLUMNS = `u.id, u.handle, u.name, u.avatar, u.bio, u.country, u.craft_level, u.role, u.last_seen, u.created_at,
  m.slug AS m_slug, m.status AS m_status, m.store_name AS m_store`;
export const USER_FROM = `users u LEFT JOIN merchants m ON m.user_id = u.id`;

export interface SessionUser { id: string; handle: string; name: string; role: string; status: string; lang: string }

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/* ------------------------------------------- accounts ------------------------------------------- */

const SESSION_DAYS = 30;

async function uniqueHandle(sql: Sql, wanted: string): Promise<string> {
  const base = (wanted.normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 20)) || 'sham';
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 && base.length >= 3 ? base : `${base}${Math.floor(1000 + Math.random() * 90000)}`;
    const [taken] = await sql.query(`SELECT 1 FROM users WHERE handle = $1`, [candidate]);
    if (!taken) return candidate;
  }
  return `sham${Date.now().toString(36)}`;
}

async function startSession(ctx: Ctx, userId: string, agent: string) {
  const { token, hash } = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await ctx.sql.query(`INSERT INTO sessions (hash, user_id, agent, expires_at) VALUES ($1, $2, $3, $4)`, [hash, userId, clean(agent, 200), expires.toISOString()]);
  return { token, expiresAt: expires.toISOString() };
}

export interface RegisterInput {
  name?: unknown; email?: unknown; password?: unknown; handle?: unknown; country?: unknown; lang?: unknown; craftLevel?: unknown;
  /** Private data kept encrypted: phone, city, address. */
  phone?: unknown; city?: unknown;
}

export function passwordPolicy(password: unknown): string {
  const text = typeof password === 'string' ? password : '';
  if (text.length < 8 || text.length > 200 || !/[A-Za-z\u0600-\u06FF]/.test(text) || !/\d/.test(text)) fail(400, 'WEAK_PASSWORD');
  return text;
}

export async function register(ctx: Ctx, input: RegisterInput, agent = '') {
  const name = required(input.name, 'name', 2, 60);
  const email = clean(input.email, 254).toLowerCase();
  if (!isEmail(email)) fail(400, 'INVALID_EMAIL');
  const password = passwordPolicy(input.password);
  const country = clean(input.country, 2).toUpperCase();
  const lang = clean(input.lang, 10);
  const craft = CRAFT.includes(String(input.craftLevel)) ? String(input.craftLevel) : 'hobbyist';
  const emailIdx = ctx.vault.index(email);
  const [exists] = await ctx.sql.query(`SELECT 1 FROM users WHERE email_idx = $1`, [emailIdx]);
  if (exists) fail(409, 'EMAIL_EXISTS');
  const id = newId('u');
  const handle = await uniqueHandle(ctx.sql, clean(input.handle, 30) || email.split('@')[0] || name);
  const privateData = { phone: clean(input.phone, 40), city: clean(input.city, 120) };
  await ctx.sql.query(
    `INSERT INTO users (id, handle, name, email_idx, email_enc, pass_hash, country, lang, craft_level, private_enc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, handle, name, emailIdx, ctx.vault.seal(email), await hashPassword(password), isCountry(country) ? country : '', LANG.test(lang) ? lang : 'ar', craft,
      privateData.phone || privateData.city ? ctx.vault.sealJson(privateData) : null],
  ).catch((error) => { if (/unique|duplicate/i.test(String(error?.message))) fail(409, 'EMAIL_EXISTS'); throw error; });
  return { ...(await startSession(ctx, id, agent)), me: await me(ctx, id) };
}

export async function login(ctx: Ctx, input: { email?: unknown; password?: unknown }, agent = '') {
  const email = clean(input.email, 254).toLowerCase();
  const password = typeof input.password === 'string' ? input.password.slice(0, 200) : '';
  const [row] = isEmail(email) ? await ctx.sql.query(`SELECT id, pass_hash, status FROM users WHERE email_idx = $1`, [ctx.vault.index(email)]) : [];
  // Same answer and similar time for an unknown e-mail and a wrong password.
  const ok = await verifyPassword(password, row?.pass_hash || 'scrypt$32768$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  if (!row || !ok) fail(401, 'INVALID_LOGIN');
  if (row.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED');
  if (row.status === 'deleted') fail(401, 'INVALID_LOGIN');
  return { ...(await startSession(ctx, row.id, agent)), me: await me(ctx, row.id) };
}

/** The signed-in user for a bearer token, or undefined. Refreshes «last seen» at most once a minute. */
export async function authenticate(ctx: Ctx, token: string): Promise<SessionUser | undefined> {
  if (!token || token.length < 20 || token.length > 100) return undefined;
  const [row] = await ctx.sql.query(
    `SELECT u.id, u.handle, u.name, u.role, u.status, u.lang, u.last_seen FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.hash = $1 AND s.expires_at > now()`, [tokenHash(token)]);
  if (!row || row.status !== 'active') return undefined;
  if (Date.now() - new Date(row.last_seen).getTime() > 60_000) await ctx.sql.query(`UPDATE users SET last_seen = now() WHERE id = $1`, [row.id]);
  return { id: row.id, handle: row.handle, name: row.name, role: row.role, status: row.status, lang: row.lang };
}

export async function logout(ctx: Ctx, token: string, everywhere = false) {
  if (everywhere) {
    const [row] = await ctx.sql.query(`SELECT user_id FROM sessions WHERE hash = $1`, [tokenHash(token)]);
    if (row) await ctx.sql.query(`DELETE FROM sessions WHERE user_id = $1`, [row.user_id]);
  } else await ctx.sql.query(`DELETE FROM sessions WHERE hash = $1`, [tokenHash(token)]);
}

/** Everything the signed-in user may see about themself (their own private data decrypted). */
export async function me(ctx: Ctx, userId: string) {
  const [u] = await ctx.sql.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!u) fail(404, 'NOT_FOUND');
  const [m] = await ctx.sql.query(`SELECT slug, store_name, status, admin_note FROM merchants WHERE user_id = $1`, [userId]);
  const [counts] = await ctx.sql.query(
    `SELECT (SELECT count(*) FROM recipes WHERE user_id = $1)::int AS recipes,
            (SELECT count(*) FROM friendships WHERE (user_a = $1 OR user_b = $1) AND status = 'accepted')::int AS friends,
            (SELECT count(*) FROM orders WHERE buyer_id = $1)::int AS orders,
            (SELECT count(*) FROM posts WHERE author_id = $1 AND status = 'visible')::int AS posts`, [userId]);
  return {
    id: u.id, handle: u.handle, name: u.name, email: ctx.vault.open(u.email_enc), role: u.role, status: u.status,
    country: u.country, lang: u.lang, craftLevel: u.craft_level, bio: u.bio, avatar: u.avatar || null,
    private: ctx.vault.openJson(u.private_enc, { phone: '', city: '' }), createdAt: iso(u.created_at),
    merchant: m ? { slug: m.slug, storeName: m.store_name, status: m.status, note: m.status === 'approved' ? '' : m.admin_note } : null,
    counts: counts || { recipes: 0, friends: 0, orders: 0, posts: 0 },
  };
}

export async function updateProfile(ctx: Ctx, userId: string, input: Record<string, unknown>) {
  const sets: string[] = []; const params: unknown[] = [];
  const set = (column: string, value: unknown) => { params.push(value); sets.push(`${column} = $${params.length}`); };
  if (input.name !== undefined) set('name', required(input.name, 'name', 2, 60));
  if (input.bio !== undefined) set('bio', clean(input.bio, 500));
  if (input.avatar !== undefined) set('avatar', image(input.avatar, 250));
  if (input.country !== undefined) { const c = clean(input.country, 2).toUpperCase(); set('country', isCountry(c) ? c : ''); }
  if (input.lang !== undefined && LANG.test(clean(input.lang, 10))) set('lang', clean(input.lang, 10));
  if (input.craftLevel !== undefined && CRAFT.includes(String(input.craftLevel))) set('craft_level', String(input.craftLevel));
  if (input.handle !== undefined) {
    const handle = clean(input.handle, 30).toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) fail(400, 'INVALID_HANDLE');
    const [taken] = await ctx.sql.query(`SELECT 1 FROM users WHERE handle = $1 AND id <> $2`, [handle, userId]);
    if (taken) fail(409, 'HANDLE_TAKEN');
    set('handle', handle);
  }
  if (input.private !== undefined) {
    const p = (input.private || {}) as Record<string, unknown>;
    set('private_enc', ctx.vault.sealJson({ phone: clean(p.phone, 40), city: clean(p.city, 120), address: clean(p.address, 300) }));
  }
  if (sets.length) { params.push(userId); await ctx.sql.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params); }
  return me(ctx, userId);
}

export async function changePassword(ctx: Ctx, userId: string, input: { current?: unknown; next?: unknown }) {
  const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(input.current || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  await ctx.sql.query(`UPDATE users SET pass_hash = $1 WHERE id = $2`, [await hashPassword(passwordPolicy(input.next)), userId]);
}

/** «احذف حسابي»: personal data is erased; posts and messages are removed with the account. */
export async function deleteAccount(ctx: Ctx, userId: string, password: unknown) {
  const [u] = await ctx.sql.query(`SELECT pass_hash FROM users WHERE id = $1`, [userId]);
  if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) fail(401, 'WRONG_PASSWORD');
  await ctx.sql.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

/* ------------------------------------------ merchants ------------------------------------------ */

const CURRENCY = /^[A-Z]{3}$/;
const slugOf = (text: string) => text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export interface MerchantInput {
  storeName?: unknown; about?: unknown; logo?: unknown; country?: unknown; currency?: unknown;
  /** Private (encrypted, admin only): legal name, registration number, tax id, phone, WhatsApp, address. */
  legal?: Record<string, unknown>;
  /** Private (encrypted, admin only): how the site pays the merchant. */
  payout?: Record<string, unknown>;
}
const legalOf = (l: Record<string, unknown> = {}) => ({
  legalName: clean(l.legalName, 160), registration: clean(l.registration, 80), taxId: clean(l.taxId, 80),
  phone: clean(l.phone, 40), whatsapp: clean(l.whatsapp, 40), address: clean(l.address, 300), website: clean(l.website, 300),
});
const payoutOf = (p: Record<string, unknown> = {}) => ({
  method: ['bank', 'wallet', 'instapay', 'other'].includes(String(p.method)) ? String(p.method) : 'bank',
  bankName: clean(p.bankName, 120), accountHolder: clean(p.accountHolder, 160), iban: clean(p.iban, 60), wallet: clean(p.wallet, 60), notes: clean(p.notes, 300),
});

/** «سجّل كتاجر»: the store is created «pending»; the administration reviews and approves it. */
export async function applyMerchant(ctx: Ctx, userId: string, input: MerchantInput) {
  const [existing] = await ctx.sql.query(`SELECT status FROM merchants WHERE user_id = $1`, [userId]);
  if (existing) fail(409, 'ALREADY_MERCHANT');
  const storeName = required(input.storeName, 'storeName', 2, 80);
  const legal = legalOf(input.legal);
  if (legal.phone.replace(/\D/g, '').length < 7) fail(400, 'INVALID_FIELD', 'phone');
  const currency = clean(input.currency, 3).toUpperCase();
  const country = clean(input.country, 2).toUpperCase();
  let slug = slugOf(storeName) || 'store';
  const [taken] = await ctx.sql.query(`SELECT 1 FROM merchants WHERE slug = $1`, [slug]);
  if (taken) slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  await ctx.sql.tx(async (t) => {
    await t.query(
      `INSERT INTO merchants (user_id, slug, store_name, about, logo, country, currency, legal_enc, payout_enc) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, slug, storeName, clean(input.about, 1500), image(input.logo, 200), isCountry(country) ? country : '', CURRENCY.test(currency) ? currency : 'EGP',
        ctx.vault.sealJson(legal), ctx.vault.sealJson(payoutOf(input.payout))]);
    await t.query(`UPDATE users SET role = 'merchant' WHERE id = $1`, [userId]);
  });
  return myMerchant(ctx, userId);
}

export async function myMerchant(ctx: Ctx, userId: string) {
  const [m] = await ctx.sql.query(`SELECT * FROM merchants WHERE user_id = $1`, [userId]);
  if (!m) fail(404, 'NOT_MERCHANT');
  const [stats] = await ctx.sql.query(
    `SELECT (SELECT count(*) FROM merchant_products WHERE merchant_id = $1)::int AS products,
            (SELECT count(*) FROM merchant_products WHERE merchant_id = $1 AND status = 'approved')::int AS published,
            (SELECT count(*) FROM merchant_products WHERE merchant_id = $1 AND status = 'pending')::int AS pending,
            (SELECT count(*) FROM orders WHERE merchant_id = $1 AND status NOT IN ('awaiting_payment','cancelled'))::int AS orders,
            (SELECT coalesce(sum(merchant_total), 0) FROM orders WHERE merchant_id = $1 AND status IN ('paid','processing','shipped','delivered'))::float AS earnings`, [userId]);
  return {
    slug: m.slug, storeName: m.store_name, about: m.about, logo: m.logo || null, country: m.country, currency: m.currency, status: m.status,
    note: m.admin_note, legal: ctx.vault.openJson(m.legal_enc, legalOf()), payout: ctx.vault.openJson(m.payout_enc, payoutOf()),
    createdAt: iso(m.created_at), reviewedAt: iso(m.reviewed_at), stats,
  };
}

export async function updateMerchant(ctx: Ctx, userId: string, input: MerchantInput) {
  const current = await myMerchant(ctx, userId);
  const storeName = input.storeName !== undefined ? required(input.storeName, 'storeName', 2, 80) : current.storeName;
  const currency = input.currency !== undefined && CURRENCY.test(clean(input.currency, 3).toUpperCase()) ? clean(input.currency, 3).toUpperCase() : current.currency;
  const country = input.country !== undefined ? clean(input.country, 2).toUpperCase() : current.country;
  await ctx.sql.query(
    `UPDATE merchants SET store_name = $1, about = $2, logo = $3, country = $4, currency = $5, legal_enc = $6, payout_enc = $7 WHERE user_id = $8`,
    [storeName, input.about !== undefined ? clean(input.about, 1500) : current.about, input.logo !== undefined ? image(input.logo, 200) : current.logo,
      isCountry(country) ? country : '', currency, ctx.vault.sealJson(input.legal ? legalOf(input.legal) : current.legal),
      ctx.vault.sealJson(input.payout ? payoutOf(input.payout) : current.payout), userId]);
  return myMerchant(ctx, userId);
}

/* ---------------------------------------- merchant products ---------------------------------------- */

const CATEGORIES = ['perfume', 'oil', 'raw_material', 'alcohol', 'bottle', 'packaging', 'tool', 'other'];
export interface ProductInput {
  name?: unknown; description?: unknown; category?: unknown; images?: unknown; price?: unknown; currency?: unknown; stock?: unknown;
  /** Private between the merchant and the site: where the product is, supplier links, internal notes. */
  source?: { links?: unknown; notes?: unknown };
}

const sourceOf = (s: ProductInput['source'] = {}) => ({
  links: (Array.isArray(s.links) ? s.links : String(s.links || '').split(/\s+/)).map((l) => clean(l, 600)).filter((l) => /^https?:\/\//.test(l)).slice(0, 10),
  notes: clean(s.notes, 1000),
});
/** Public descriptions must not carry contact routes: links, phone numbers and e-mails are removed. */
export function stripContacts(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+|\b[\w.-]+\.(com|net|org|shop|store|me|io|eg|sa|ae|co)(\/\S*)?\b/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '')
    .replace(/@[A-Za-z0-9_.]{3,}/g, '')
    .replace(/[ \t]{2,}/g, ' ').trim();
}

function productRow(ctx: Ctx, row: Row, owner: boolean) {
  return {
    id: row.id, name: row.name, description: row.description, category: row.category, images: row.images || [],
    price: row.price, currency: row.currency, stock: row.stock, status: row.status, reviewNote: row.review_note,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    ...(owner ? { source: ctx.vault.openJson(row.source_enc, sourceOf()) } : {}),
  };
}

function productFields(input: ProductInput, partial = false) {
  const out: Record<string, unknown> = {};
  if (!partial || input.name !== undefined) out.name = stripContacts(required(input.name, 'name', 2, 140));
  if (!partial || input.description !== undefined) out.description = stripContacts(clean(input.description, 4000));
  if (!partial || input.category !== undefined) out.category = CATEGORIES.includes(String(input.category)) ? String(input.category) : 'other';
  if (!partial || input.images !== undefined) {
    const list = Array.isArray(input.images) ? input.images.slice(0, 6) : [];
    out.images = JSON.stringify(list.map((i) => image(i, 400, true)).filter(Boolean));
  }
  if (!partial || input.price !== undefined) {
    const price = Number(input.price);
    if (!(price > 0 && price < 10_000_000)) fail(400, 'INVALID_FIELD', 'price');
    out.price = Math.round(price * 100) / 100;
  }
  if (!partial || input.currency !== undefined) {
    const currency = clean(input.currency, 3).toUpperCase();
    if (!CURRENCY.test(currency)) fail(400, 'INVALID_FIELD', 'currency');
    out.currency = currency;
  }
  if (!partial || input.stock !== undefined) {
    const stock = Number(input.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) fail(400, 'INVALID_FIELD', 'stock');
    out.stock = stock;
  }
  return out;
}

async function approvedMerchant(ctx: Ctx, userId: string) {
  const [m] = await ctx.sql.query(`SELECT status, currency FROM merchants WHERE user_id = $1`, [userId]);
  if (!m) fail(403, 'NOT_MERCHANT');
  if (m.status === 'suspended' || m.status === 'rejected') fail(403, 'MERCHANT_SUSPENDED');
  return m;
}

/** A new product always waits for the administration's review before it is published. */
export async function createProduct(ctx: Ctx, userId: string, input: ProductInput) {
  await approvedMerchant(ctx, userId);
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM merchant_products WHERE merchant_id = $1`, [userId]);
  if (n >= 500) fail(400, 'PRODUCT_LIMIT');
  const f = productFields(input);
  const id = newId('mp');
  await ctx.sql.query(
    `INSERT INTO merchant_products (id, merchant_id, name, description, category, images, price, currency, stock, source_enc)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
    [id, userId, f.name, f.description, f.category, f.images, f.price, f.currency, f.stock, ctx.vault.sealJson(sourceOf(input.source))]);
  const [row] = await ctx.sql.query(`SELECT * FROM merchant_products WHERE id = $1`, [id]);
  return productRow(ctx, row, true);
}

/** Editing what buyers see (name, description, pictures, price) sends the product back to review; stock does not. */
export async function updateProduct(ctx: Ctx, userId: string, productId: string, input: ProductInput & { paused?: unknown }) {
  await approvedMerchant(ctx, userId);
  const [row] = await ctx.sql.query(`SELECT * FROM merchant_products WHERE id = $1 AND merchant_id = $2`, [productId, userId]);
  if (!row) fail(404, 'NOT_FOUND');
  const f = productFields(input, true);
  const reviewed = ['name', 'description', 'images', 'price', 'currency', 'category'].some((k) => k in f);
  const sets: string[] = []; const params: unknown[] = [];
  for (const [key, value] of Object.entries(f)) { params.push(value); sets.push(`${key} = $${params.length}${key === 'images' ? '::jsonb' : ''}`); }
  if (input.source !== undefined) { params.push(ctx.vault.sealJson(sourceOf(input.source))); sets.push(`source_enc = $${params.length}`); }
  let status = row.status;
  if (reviewed && row.status !== 'pending') status = 'pending';
  if (input.paused === true && status === 'approved') status = 'paused';
  if (input.paused === false && row.status === 'paused' && !reviewed) status = 'approved';
  params.push(status); sets.push(`status = $${params.length}`);
  sets.push('updated_at = now()');
  params.push(productId);
  await ctx.sql.query(`UPDATE merchant_products SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  const [updated] = await ctx.sql.query(`SELECT * FROM merchant_products WHERE id = $1`, [productId]);
  return productRow(ctx, updated, true);
}

export async function deleteProduct(ctx: Ctx, userId: string, productId: string) {
  const rows = await ctx.sql.query(`DELETE FROM merchant_products WHERE id = $1 AND merchant_id = $2 RETURNING id`, [productId, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

export async function myProducts(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT * FROM merchant_products WHERE merchant_id = $1 ORDER BY updated_at DESC`, [userId]);
  return rows.map((r) => productRow(ctx, r, true));
}

/** The site's selling price in EGP: the merchant's price converted, plus the site's 50 %. */
export const SITE_MARGIN = 0.5;
export function sellingPriceEgp(price: number, currency: string, fx: FxTable = BUNDLED_FX): number {
  return tidy(convert(price, currency, 'EGP', fx) * (1 + SITE_MARGIN));
}

const publicProduct = (row: Row, fx: FxTable) => ({
  sku: row.id, id: row.id, name: row.name, description: row.description, category: row.category, images: row.images || [],
  priceEgp: sellingPriceEgp(row.price, row.currency, fx), inStock: row.stock > 0,
  store: row.m_slug ? { slug: row.m_slug, name: row.m_store } : undefined,
});

/** «متاجر شام»: approved stores with their published products — never a source link or a contact. */
export async function storeDirectory(ctx: Ctx) {
  const rows = await ctx.sql.query(
    `SELECT m.slug, m.store_name, m.about, m.logo, m.country,
            (SELECT count(*) FROM merchant_products p WHERE p.merchant_id = m.user_id AND p.status = 'approved')::int AS products
     FROM merchants m JOIN users u ON u.id = m.user_id WHERE m.status = 'approved' AND u.status = 'active' ORDER BY products DESC, m.store_name`);
  return rows.map((r) => ({ slug: r.slug, name: r.store_name, about: stripContacts(r.about), logo: r.logo || null, country: r.country, products: r.products }));
}

export async function storePage(ctx: Ctx, slug: string) {
  const [m] = await ctx.sql.query(
    `SELECT m.*, u.handle FROM merchants m JOIN users u ON u.id = m.user_id WHERE m.slug = $1 AND m.status = 'approved' AND u.status = 'active'`, [clean(slug, 60)]);
  if (!m) fail(404, 'NOT_FOUND');
  const fx = await (ctx.fx?.() ?? Promise.resolve(BUNDLED_FX)).catch(() => BUNDLED_FX);
  const rows = await ctx.sql.query(`SELECT * FROM merchant_products WHERE merchant_id = $1 AND status = 'approved' ORDER BY updated_at DESC`, [m.user_id]);
  return {
    store: { slug: m.slug, name: m.store_name, about: stripContacts(m.about), logo: m.logo || null, country: m.country, since: iso(m.reviewed_at || m.created_at) },
    products: rows.map((r) => publicProduct({ ...r, m_slug: m.slug, m_store: m.store_name }, fx)),
  };
}

/** Published merchant products by sku, priced for the checkout (server-side, never trusted from the browser). */
export async function productsForCheckout(ctx: Ctx, skus: string[]) {
  const ids = skus.filter((s) => /^mp_[A-Za-z0-9_-]{8,40}$/.test(s));
  if (!ids.length) return [];
  const fx = await (ctx.fx?.() ?? Promise.resolve(BUNDLED_FX)).catch(() => BUNDLED_FX);
  const rows = await ctx.sql.query(
    `SELECT p.*, m.slug AS m_slug, m.store_name AS m_store FROM merchant_products p JOIN merchants m ON m.user_id = p.merchant_id
     WHERE p.id = ANY($1) AND p.status = 'approved' AND m.status = 'approved'`, [ids]);
  return rows.map((r) => ({
    ...publicProduct(r, fx), merchantId: r.merchant_id, merchantPrice: r.price, merchantCurrency: r.currency, stock: r.stock,
    price: sellingPriceEgp(r.price, r.currency, fx), costEgp: convert(r.price, r.currency, 'EGP', fx),
  }));
}

/* --------------------------------------------- orders --------------------------------------------- */

export const orderNumber = () => `SO-${new Date().getUTCFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/**
 * Records the merchant part of a checkout (one order per merchant) when the payment page is opened. The
 * buyer's address is encrypted; the merchant sees items and their own amount, the administration sees all.
 */
export async function recordCheckout(ctx: Ctx, input: {
  ref: string; buyerId?: string; country: string; items: { sku: string; qty: number }[];
  address: Record<string, unknown>; shippingUsd: number; total: number; currency: string;
}) {
  const products = await productsForCheckout(ctx, input.items.map((i) => i.sku));
  const byMerchant = new Map<string, typeof products>();
  for (const p of products) byMerchant.set(p.merchantId, [...(byMerchant.get(p.merchantId) || []), p]);
  for (const [merchantId, list] of byMerchant) {
    const items = list.map((p) => {
      const qty = input.items.find((i) => i.sku === p.sku)!.qty;
      return { sku: p.sku, name: p.name, qty, merchantUnit: p.merchantPrice, unitEgp: p.price, costEgp: p.costEgp, image: p.images[0] && !String(p.images[0]).startsWith('data:') ? p.images[0] : undefined };
    });
    const merchantTotal = items.reduce((s, i) => s + i.merchantUnit * i.qty, 0);
    // The site's margin: what the buyer pays for the products minus what the merchant receives (both in EGP).
    const marginEgp = items.reduce((s, i) => s + (i.unitEgp - i.costEgp) * i.qty, 0);
    await ctx.sql.query(
      `INSERT INTO orders (id, number, buyer_id, merchant_id, items, merchant_total, merchant_currency, margin_egp, shipping_usd, total_charged, charge_currency, country, address_enc, payment_ref)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [newId('o'), orderNumber(), input.buyerId || null, merchantId, JSON.stringify(items), Math.round(merchantTotal * 100) / 100, list[0].merchantCurrency,
        Math.round(marginEgp * 100) / 100, input.shippingUsd, input.total, input.currency, input.country,
        ctx.vault.sealJson(input.address), input.ref]);
  }
  return byMerchant.size;
}

/** Kashier confirmed the payment (verified server-side): the merchants' orders become «paid», stock is reserved. */
export async function markPaid(ctx: Ctx, ref: string) {
  const rows = await ctx.sql.query(`UPDATE orders SET status = 'paid', updated_at = now() WHERE payment_ref = $1 AND status = 'awaiting_payment' RETURNING merchant_id, items`, [ref]);
  for (const row of rows) {
    for (const item of row.items as { sku: string; qty: number }[]) {
      await ctx.sql.query(`UPDATE merchant_products SET stock = greatest(0, stock - $1) WHERE id = $2`, [item.qty, item.sku]);
    }
    await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, ref) VALUES ($1, $2, 'order_paid', $3)`, [newId('n'), row.merchant_id, ref]);
  }
  return rows.length;
}

const orderView = (row: Row, side: 'buyer' | 'merchant') => ({
  id: row.id, number: row.number, status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), country: row.country,
  items: (row.items as Row[]).map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, image: i.image, ...(side === 'merchant' ? { unit: i.merchantUnit } : {}) })),
  ...(side === 'merchant' ? { amount: row.merchant_total, currency: row.merchant_currency } : { total: row.total_charged, currency: row.charge_currency, store: row.m_store }),
});

export async function myOrders(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(
    `SELECT o.*, m.store_name AS m_store FROM orders o LEFT JOIN merchants m ON m.user_id = o.merchant_id WHERE o.buyer_id = $1 ORDER BY o.created_at DESC LIMIT 200`, [userId]);
  return rows.map((r) => orderView(r, 'buyer'));
}

export async function merchantOrders(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT * FROM orders WHERE merchant_id = $1 AND status <> 'awaiting_payment' ORDER BY created_at DESC LIMIT 300`, [userId]);
  return rows.map((r) => orderView(r, 'merchant'));
}

/** The merchant may only report preparation; shipping and delivery are set by the administration. */
export async function merchantOrderReady(ctx: Ctx, userId: string, orderId: string) {
  const rows = await ctx.sql.query(`UPDATE orders SET status = 'processing', updated_at = now() WHERE id = $1 AND merchant_id = $2 AND status = 'paid' RETURNING id`, [orderId, userId]);
  if (!rows.length) fail(409, 'INVALID_STATE');
}

/* ------------------------------------------ recipes & learning ------------------------------------------ */

const VISIBILITY = ['private', 'friends', 'public'];

export async function saveRecipe(ctx: Ctx, userId: string, input: { id?: unknown; title?: unknown; data?: unknown; notes?: unknown; visibility?: unknown }) {
  const title = required(input.title, 'title', 1, 140);
  const data = input.data && typeof input.data === 'object' ? JSON.stringify(input.data) : '{}';
  if (data.length > 60_000) fail(400, 'RECIPE_TOO_LARGE');
  const visibility = VISIBILITY.includes(String(input.visibility)) ? String(input.visibility) : 'private';
  const id = typeof input.id === 'string' && /^r_[\w-]{8,40}$/.test(input.id) ? input.id : '';
  if (id) {
    const rows = await ctx.sql.query(
      `UPDATE recipes SET title = $1, data = $2::jsonb, notes = $3, visibility = $4, updated_at = now() WHERE id = $5 AND user_id = $6 RETURNING id`,
      [title, data, clean(input.notes, 3000), visibility, id, userId]);
    if (!rows.length) fail(404, 'NOT_FOUND');
    return getRecipe(ctx, userId, id);
  }
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM recipes WHERE user_id = $1`, [userId]);
  if (n >= 1000) fail(400, 'RECIPE_LIMIT');
  const newRecipe = newId('r');
  await ctx.sql.query(`INSERT INTO recipes (id, user_id, title, data, notes, visibility) VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
    [newRecipe, userId, title, data, clean(input.notes, 3000), visibility]);
  return getRecipe(ctx, userId, newRecipe);
}

const recipeView = (r: Row) => ({ id: r.id, title: r.title, data: r.data, notes: r.notes, visibility: r.visibility, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });

export async function getRecipe(ctx: Ctx, viewerId: string | undefined, id: string) {
  const [r] = await ctx.sql.query(`SELECT * FROM recipes WHERE id = $1`, [id]);
  if (!r) fail(404, 'NOT_FOUND');
  if (r.user_id !== viewerId && r.visibility !== 'public') {
    const friends = viewerId ? await areFriends(ctx.sql, r.user_id, viewerId) : false;
    if (!(r.visibility === 'friends' && friends)) fail(404, 'NOT_FOUND');
  }
  return recipeView(r);
}

export async function myRecipes(ctx: Ctx, userId: string) {
  return (await ctx.sql.query(`SELECT * FROM recipes WHERE user_id = $1 ORDER BY updated_at DESC`, [userId])).map(recipeView);
}

export async function deleteRecipe(ctx: Ctx, userId: string, id: string) {
  const rows = await ctx.sql.query(`DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

/** «رحلة التعلّم»: progress (0–100) per lesson / tool / material the user studied on the site. */
export async function saveLearning(ctx: Ctx, userId: string, input: { itemId?: unknown; kind?: unknown; title?: unknown; progress?: unknown }) {
  const itemId = required(input.itemId, 'itemId', 1, 80);
  const progress = Math.max(0, Math.min(100, Math.round(Number(input.progress) || 0)));
  const kind = ['lesson', 'tool', 'material', 'guide'].includes(String(input.kind)) ? String(input.kind) : 'lesson';
  await ctx.sql.query(
    `INSERT INTO learning (user_id, item_id, kind, title, progress) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, item_id) DO UPDATE SET progress = greatest(learning.progress, EXCLUDED.progress), title = EXCLUDED.title, updated_at = now()`,
    [userId, itemId, kind, clean(input.title, 140), progress]);
  return myLearning(ctx, userId);
}

export async function myLearning(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT * FROM learning WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  return rows.map((r) => ({ itemId: r.item_id, kind: r.kind, title: r.title, progress: r.progress, updatedAt: iso(r.updated_at) }));
}

/* ------------------------------------------- helpers ------------------------------------------- */

export async function areFriends(sql: Sql, a: string, b: string): Promise<boolean> {
  const [x, y] = a < b ? [a, b] : [b, a];
  const [row] = await sql.query(`SELECT 1 FROM friendships WHERE user_a = $1 AND user_b = $2 AND status = 'accepted'`, [x, y]);
  return Boolean(row);
}

export async function isBlocked(sql: Sql, a: string, b: string): Promise<boolean> {
  const [row] = await sql.query(`SELECT 1 FROM blocks WHERE (blocker = $1 AND blocked = $2) OR (blocker = $2 AND blocked = $1)`, [a, b]);
  return Boolean(row);
}

/** Everything the user stored, as one JSON document (data portability). */
export async function exportMyData(ctx: Ctx, userId: string) {
  const [account, recipes, learning, orders] = await Promise.all([me(ctx, userId), myRecipes(ctx, userId), myLearning(ctx, userId), myOrders(ctx, userId)]);
  const posts = await ctx.sql.query(`SELECT id, body, visibility, created_at FROM posts WHERE author_id = $1 ORDER BY created_at DESC`, [userId]);
  const merchant = account.merchant ? await myMerchant(ctx, userId).catch(() => null) : null;
  return { exportedAt: new Date().toISOString(), account, merchant, recipes, learning, orders, posts };
}
