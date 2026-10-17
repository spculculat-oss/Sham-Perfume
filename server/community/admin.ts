/**
 * «إدارة مجتمع شام» — the only place where every account, store, product, order, post and conversation
 * can be read in full (decrypted) and acted on. Every read of private data and every action is written
 * to the audit log, so the administration's own access is accountable too.
 */
import type { Row } from './db';
import { newId } from './crypto';
import { SITE_STORE, USER_COLUMNS, USER_FROM, clean, fail, publicUser, type Ctx } from './service';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function audit(ctx: Ctx, action: string, target = '', detail = '') {
  await ctx.sql.query(`INSERT INTO audit (actor, action, target, detail) VALUES ('admin', $1, $2, $3)`, [action, target, clean(detail, 500)]);
}

export async function overview(ctx: Ctx) {
  const [row] = await ctx.sql.query(`SELECT
    (SELECT count(*) FROM users)::int AS users,
    (SELECT count(*) FROM users WHERE last_seen > now() - interval '5 minutes')::int AS online,
    (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS new_week,
    (SELECT count(*) FROM users WHERE status = 'suspended')::int AS suspended,
    (SELECT count(*) FROM merchants)::int AS merchants,
    (SELECT count(*) FROM merchants WHERE status = 'pending')::int AS merchants_pending,
    (SELECT count(*) FROM merchant_products)::int AS products,
    (SELECT count(*) FROM merchant_products WHERE status = 'pending')::int AS products_pending,
    (SELECT count(*) FROM orders WHERE status <> 'awaiting_payment')::int AS orders,
    (SELECT count(*) FROM orders WHERE status = 'paid')::int AS orders_to_ship,
    (SELECT coalesce(sum(margin_egp), 0) FROM orders WHERE status IN ('paid','processing','shipped','delivered'))::float AS margin_egp,
    (SELECT count(*) FROM posts WHERE status = 'visible')::int AS posts,
    (SELECT count(*) FROM messages)::int AS messages,
    (SELECT count(*) FROM conversations)::int AS conversations,
    (SELECT count(*) FROM recipes)::int AS recipes,
    (SELECT count(*) FROM reports WHERE status = 'open')::int AS reports_open`);
  return row;
}

/* --------------------------------------------- users --------------------------------------------- */

export async function users(ctx: Ctx, options: { q?: unknown; status?: unknown; role?: unknown; offset?: unknown } = {}) {
  const params: unknown[] = []; const where: string[] = [];
  const q = clean(options.q, 80).toLowerCase();
  if (q) {
    // E-mails are encrypted: an exact e-mail is matched through its blind index.
    params.push(`%${q.replace(/[%_\\]/g, '')}%`, clean(options.q, 80), q.includes('@') ? ctx.vault.index(q) : '-');
    const n = params.length;
    where.push(`(lower(u.name) LIKE $${n - 2} OR u.handle LIKE $${n - 2} OR u.id = $${n - 1} OR u.email_idx = $${n})`);
  }
  if (['active', 'suspended'].includes(String(options.status))) { params.push(options.status); where.push(`u.status = $${params.length}`); }
  if (['user', 'merchant'].includes(String(options.role))) { params.push(options.role); where.push(`u.role = $${params.length}`); }
  const offset = Math.max(0, Math.min(100_000, Number(options.offset) || 0));
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, u.status, u.email_enc, u.lang, m.status AS merchant_status FROM ${USER_FROM}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.created_at DESC LIMIT 50 OFFSET ${offset}`, params);
  return rows.map((r) => ({ ...publicUser(r), status: r.status, email: ctx.vault.open(r.email_enc), lang: r.lang, merchantStatus: r.merchant_status || null, createdAt: iso(r.created_at) }));
}

/** The complete file of one member: account and private data, store, products, orders, recipes, friends, posts, chats. */
export async function userFile(ctx: Ctx, userId: string) {
  const [u] = await ctx.sql.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!u) fail(404, 'NOT_FOUND');
  await audit(ctx, 'view_user', userId);
  const [m] = await ctx.sql.query(`SELECT * FROM merchants WHERE user_id = $1`, [userId]);
  const [products, orders, recipes, learning, friends, posts, chats, sessions, reports] = await Promise.all([
    ctx.sql.query(`SELECT * FROM merchant_products WHERE merchant_id = $1 ORDER BY updated_at DESC`, [userId]),
    ctx.sql.query(`SELECT * FROM orders WHERE buyer_id = $1 OR merchant_id = $1 ORDER BY created_at DESC LIMIT 200`, [userId]),
    ctx.sql.query(`SELECT id, title, visibility, data, updated_at FROM recipes WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]),
    ctx.sql.query(`SELECT * FROM learning WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]),
    ctx.sql.query(`SELECT ${USER_COLUMNS}, f.status AS f_status FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
                   LEFT JOIN merchants m ON m.user_id = u.id WHERE f.user_a = $1 OR f.user_b = $1`, [userId]),
    ctx.sql.query(`SELECT id, body, image, visibility, status, created_at FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId]),
    ctx.sql.query(`SELECT c.id, c.kind, c.title, c.last_at, (SELECT count(*) FROM messages x WHERE x.conversation_id = c.id)::int AS messages,
                     (SELECT string_agg(u2.name, '، ') FROM members mb2 JOIN users u2 ON u2.id = mb2.user_id WHERE mb2.conversation_id = c.id AND mb2.user_id <> $1) AS with_names
                   FROM members mb JOIN conversations c ON c.id = mb.conversation_id WHERE mb.user_id = $1 ORDER BY c.last_at DESC`, [userId]),
    ctx.sql.query(`SELECT agent, created_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`, [userId]),
    ctx.sql.query(`SELECT * FROM reports WHERE target_id = $1 OR reporter_id = $1 ORDER BY created_at DESC`, [userId]),
  ]);
  return {
    account: {
      id: u.id, handle: u.handle, name: u.name, email: ctx.vault.open(u.email_enc), role: u.role, status: u.status, country: u.country, lang: u.lang,
      craftLevel: u.craft_level, bio: u.bio, avatar: u.avatar, private: ctx.vault.openJson(u.private_enc, {}), createdAt: iso(u.created_at), lastSeen: iso(u.last_seen),
    },
    merchant: m ? merchantView(ctx, m) : null,
    products: products.map((p) => productView(ctx, p)),
    orders: orders.map((o) => orderView(ctx, o)),
    recipes: recipes.map((r) => ({ id: r.id, title: r.title, visibility: r.visibility, data: r.data, updatedAt: iso(r.updated_at) })),
    learning: learning.map((l) => ({ itemId: l.item_id, kind: l.kind, title: l.title, progress: l.progress, updatedAt: iso(l.updated_at) })),
    friends: friends.map((f) => ({ ...publicUser(f), status: f.f_status })),
    posts: posts.map((p) => ({ id: p.id, body: p.body, image: p.image, visibility: p.visibility, status: p.status, createdAt: iso(p.created_at) })),
    conversations: chats.map((c) => ({ id: c.id, kind: c.kind, title: c.title || c.with_names || '', messages: c.messages, lastAt: iso(c.last_at) })),
    sessions: sessions.map((s) => ({ agent: s.agent, createdAt: iso(s.created_at), expiresAt: iso(s.expires_at) })),
    reports: reports.map(reportView),
  };
}

export async function setUserStatus(ctx: Ctx, userId: string, status: unknown, note = '') {
  if (!['active', 'suspended'].includes(String(status))) fail(400, 'INVALID_FIELD', 'status');
  const rows = await ctx.sql.query(`UPDATE users SET status = $1 WHERE id = $2 RETURNING id`, [status, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  if (status === 'suspended') await ctx.sql.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  await audit(ctx, `user_${status}`, userId, note);
}

export async function deleteUser(ctx: Ctx, userId: string, note = '') {
  const rows = await ctx.sql.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  await audit(ctx, 'user_deleted', userId, note);
}

export async function signOutEverywhere(ctx: Ctx, userId: string) {
  await ctx.sql.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  await audit(ctx, 'user_sessions_revoked', userId);
}

/* ------------------------------------------ merchants & products ------------------------------------------ */

function merchantView(ctx: Ctx, m: Row) {
  return {
    userId: m.user_id, slug: m.slug, storeName: m.store_name, about: m.about, logo: m.logo, country: m.country, currency: m.currency, status: m.status,
    note: m.admin_note, legal: ctx.vault.openJson(m.legal_enc, {}), payout: ctx.vault.openJson(m.payout_enc, {}), createdAt: iso(m.created_at), reviewedAt: iso(m.reviewed_at),
    owner: m.owner_name ? { name: m.owner_name, handle: m.owner_handle, email: ctx.vault.open(m.owner_email) } : undefined,
    products: m.products, pending: m.pending,
  };
}

export async function merchants(ctx: Ctx, status?: unknown) {
  const params: unknown[] = [];
  const filter = ['pending', 'approved', 'suspended', 'rejected'].includes(String(status)) ? (params.push(status), `WHERE m.status = $1`) : '';
  const rows = await ctx.sql.query(
    `SELECT m.*, u.name AS owner_name, u.handle AS owner_handle, u.email_enc AS owner_email,
       (SELECT count(*) FROM merchant_products p WHERE p.merchant_id = m.user_id)::int AS products,
       (SELECT count(*) FROM merchant_products p WHERE p.merchant_id = m.user_id AND p.status = 'pending')::int AS pending
     FROM merchants m JOIN users u ON u.id = m.user_id ${filter} ORDER BY (m.status = 'pending') DESC, m.created_at DESC LIMIT 300`, params);
  await audit(ctx, 'list_merchants', String(status || 'all'));
  return rows.map((m) => merchantView(ctx, m));
}

export async function reviewMerchant(ctx: Ctx, userId: string, input: { status?: unknown; note?: unknown }) {
  const status = String(input.status);
  if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) fail(400, 'INVALID_FIELD', 'status');
  const note = clean(input.note, 1000);
  const rows = await ctx.sql.query(`UPDATE merchants SET status = $1, admin_note = $2, reviewed_at = now() WHERE user_id = $3 RETURNING user_id`, [status, note, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, ref) VALUES ($1, $2, $3, '')`, [newId('n'), userId, `merchant_${status}`]);
  await audit(ctx, `merchant_${status}`, userId, note);
}

function productView(ctx: Ctx, p: Row) {
  return {
    id: p.id, merchantId: p.merchant_id, storeName: p.store_name, name: p.name, description: p.description, category: p.category, images: p.images || [],
    price: p.price, currency: p.currency, stock: p.stock, status: p.status, reviewNote: p.review_note,
    source: ctx.vault.openJson(p.source_enc, { links: [], notes: '' }), createdAt: iso(p.created_at), updatedAt: iso(p.updated_at),
  };
}

export async function products(ctx: Ctx, status?: unknown) {
  const params: unknown[] = [];
  const filter = ['pending', 'approved', 'rejected', 'paused'].includes(String(status)) ? (params.push(status), `WHERE p.status = $1`) : '';
  const rows = await ctx.sql.query(
    `SELECT p.*, m.store_name FROM merchant_products p JOIN merchants m ON m.user_id = p.merchant_id ${filter}
     ORDER BY (p.status = 'pending') DESC, p.updated_at DESC LIMIT 300`, params);
  await audit(ctx, 'list_products', String(status || 'all'));
  return rows.map((p) => productView(ctx, p));
}

/** Approve (publish), reject (with the reason shown to the merchant) or pause a product. */
export async function reviewProduct(ctx: Ctx, productId: string, input: { status?: unknown; note?: unknown }) {
  const status = String(input.status);
  if (!['approved', 'rejected', 'paused', 'pending'].includes(status)) fail(400, 'INVALID_FIELD', 'status');
  const note = clean(input.note, 1000);
  const rows = await ctx.sql.query(`UPDATE merchant_products SET status = $1, review_note = $2, updated_at = now() WHERE id = $3 RETURNING merchant_id`, [status, note, productId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, ref) VALUES ($1, $2, $3, $4)`, [newId('n'), rows[0].merchant_id, `product_${status}`, productId]);
  await audit(ctx, `product_${status}`, productId, note);
}

/* --------------------------------------------- orders --------------------------------------------- */

function orderView(ctx: Ctx, o: Row) {
  return {
    id: o.id, number: o.number, buyerId: o.buyer_id, merchantId: o.merchant_id, storeName: o.merchant_id ? o.store_name : SITE_STORE, buyerName: o.buyer_name,
    items: o.items, merchantTotal: o.merchant_total, merchantCurrency: o.merchant_currency, marginEgp: o.margin_egp, shippingUsd: o.shipping_usd,
    total: o.total_charged, currency: o.charge_currency, country: o.country, address: ctx.vault.openJson<Record<string, string>>(o.address_enc, {}), status: o.status,
    paymentRef: o.payment_ref, createdAt: iso(o.created_at), updatedAt: iso(o.updated_at),
  };
}

export async function orders(ctx: Ctx, status?: unknown) {
  const params: unknown[] = [];
  const filter = ORDER_STATES.includes(String(status)) ? (params.push(status), `WHERE o.status = $1`) : `WHERE o.status <> 'awaiting_payment'`;
  const rows = await ctx.sql.query(
    `SELECT o.*, m.store_name, u.name AS buyer_name FROM orders o LEFT JOIN merchants m ON m.user_id = o.merchant_id LEFT JOIN users u ON u.id = o.buyer_id
     ${filter} ORDER BY o.created_at DESC LIMIT 300`, params);
  await audit(ctx, 'list_orders', String(status || 'all'));
  return rows.map((o) => orderView(ctx, o));
}

const ORDER_STATES = ['awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
export async function setOrderStatus(ctx: Ctx, orderId: string, status: unknown, note = '') {
  if (!ORDER_STATES.includes(String(status))) fail(400, 'INVALID_FIELD', 'status');
  const rows = await ctx.sql.query(`UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING buyer_id, merchant_id, number`, [status, orderId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  for (const user of [rows[0].buyer_id, rows[0].merchant_id].filter(Boolean)) {
    await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, ref) VALUES ($1, $2, $3, $4)`, [newId('n'), user, `order_${status}`, rows[0].number]);
  }
  await audit(ctx, `order_${status}`, orderId, note);
}

/* ------------------------------------------ social moderation ------------------------------------------ */

export async function posts(ctx: Ctx, options: { status?: unknown; q?: unknown } = {}) {
  const params: unknown[] = []; const where: string[] = [];
  if (['visible', 'hidden', 'deleted'].includes(String(options.status))) { params.push(options.status); where.push(`p.status = $${params.length}`); }
  const q = clean(options.q, 80);
  if (q) { params.push(`%${q.replace(/[%_\\]/g, '')}%`); where.push(`p.body ILIKE $${params.length}`); }
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, p.id AS post_id, p.body, p.image, p.visibility, p.status AS post_status, p.created_at AS post_created,
       (SELECT count(*) FROM reports r WHERE r.target_kind = 'post' AND r.target_id = p.id AND r.status = 'open')::int AS reports
     FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN merchants m ON m.user_id = u.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC LIMIT 100`, params);
  return rows.map((r) => ({ id: r.post_id, body: r.body, image: r.image, visibility: r.visibility, status: r.post_status, createdAt: iso(r.post_created), reports: r.reports, author: publicUser(r) }));
}

export async function moderate(ctx: Ctx, kind: 'post' | 'comment', id: string, status: unknown, note = '') {
  if (!['visible', 'hidden', 'deleted'].includes(String(status))) fail(400, 'INVALID_FIELD', 'status');
  const table = kind === 'post' ? 'posts' : 'comments';
  const rows = await ctx.sql.query(`UPDATE ${table} SET status = $1 WHERE id = $2 RETURNING id`, [status, id]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  await audit(ctx, `${kind}_${status}`, id, note);
}

const reportView = (r: Row) => ({ id: r.id, reporterId: r.reporter_id, reporter: r.reporter_name, kind: r.target_kind, targetId: r.target_id, reason: r.reason, status: r.status, note: r.admin_note, createdAt: iso(r.created_at), resolvedAt: iso(r.resolved_at) });

export async function reports(ctx: Ctx, status: unknown = 'open') {
  const params: unknown[] = [];
  const filter = ['open', 'resolved', 'dismissed'].includes(String(status)) ? (params.push(status), `WHERE r.status = $1`) : '';
  const rows = await ctx.sql.query(`SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id ${filter} ORDER BY r.created_at DESC LIMIT 200`, params);
  return rows.map(reportView);
}

export async function resolveReport(ctx: Ctx, id: string, input: { status?: unknown; note?: unknown }) {
  const status = String(input.status);
  if (!['resolved', 'dismissed', 'open'].includes(status)) fail(400, 'INVALID_FIELD', 'status');
  const rows = await ctx.sql.query(`UPDATE reports SET status = $1, admin_note = $2, resolved_at = now() WHERE id = $3 RETURNING id`, [status, clean(input.note, 1000), id]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  await audit(ctx, `report_${status}`, id);
}

/* ------------------------------------------ conversations ------------------------------------------ */

/** Reads a conversation in full (decrypted). Always audited with the reason the administration gave. */
export async function readConversation(ctx: Ctx, conversationId: string, reason: unknown) {
  const why = clean(reason, 300);
  if (why.length < 3) fail(400, 'REASON_REQUIRED');
  const [c] = await ctx.sql.query(`SELECT * FROM conversations WHERE id = $1`, [conversationId]);
  if (!c) fail(404, 'NOT_FOUND');
  await audit(ctx, 'read_conversation', conversationId, why);
  const people = await ctx.sql.query(`SELECT ${USER_COLUMNS}, mb.role AS member_role, mb.left_at FROM members mb JOIN users u ON u.id = mb.user_id LEFT JOIN merchants m ON m.user_id = u.id WHERE mb.conversation_id = $1`, [conversationId]);
  const rows = await ctx.sql.query(`SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 500`, [conversationId]);
  return {
    conversation: { id: c.id, kind: c.kind, title: c.title, createdAt: iso(c.created_at) },
    members: people.map((p) => ({ ...publicUser(p), role: p.member_role, left: Boolean(p.left_at) })),
    messages: rows.reverse().map((m) => ({
      id: m.id, senderId: m.sender_id, kind: m.kind, text: ctx.vault.open(m.body_enc), attachment: m.attachment_enc ? ctx.vault.open(m.attachment_enc) : null,
      createdAt: iso(m.created_at), editedAt: iso(m.edited_at), deletedAt: iso(m.deleted_at),
    })),
  };
}

export async function auditLog(ctx: Ctx) {
  const rows = await ctx.sql.query(`SELECT * FROM audit ORDER BY id DESC LIMIT 300`);
  return rows.map((r) => ({ id: String(r.id), actor: r.actor, action: r.action, target: r.target, detail: r.detail, at: iso(r.created_at) }));
}
