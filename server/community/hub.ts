/**
 * «مجتمع شام» على طريقة فيسبوك — the parts the merchant's AI Studio design added, made real and persisted:
 *
 *  - Stories (24 hours): a picture and/or a short line on a coloured card, seen by friends (or everyone),
 *    with the list of members who saw them for the author only.
 *  - «مجلس النقاش»: public threads in fixed categories, replies, one vote per member, the author marks the
 *    answer that solved it.
 *  - Product reviews: one per member and product, readable by every visitor. «شراء موثّق» is set by the server
 *    only when the member has a paid order holding that product — never by the client, never invented.
 *
 * Visibility follows the rest of the community: suspended authors and blocked people (both ways) disappear.
 */
import type { Row } from './db';
import { newId } from './crypto';
import { USER_COLUMNS, clean, fail, image, publicUser, type Ctx } from './service';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const NOT_BLOCKED = (col: string) => `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = ${col}) OR (b.blocker = ${col} AND b.blocked = $1))`;
const FRIEND_OF_VIEWER = (col: string) => `EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.user_a = $1 AND f.user_b = ${col}) OR (f.user_b = $1 AND f.user_a = ${col})))`;

async function notify(ctx: Ctx, userId: string, kind: string, actorId: string, ref = '') {
  if (userId === actorId) return;
  await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, actor_id, ref) VALUES ($1,$2,$3,$4,$5)`, [newId('n'), userId, kind, actorId, ref]);
}

/* -------------------------------------------- stories -------------------------------------------- */

export const STORY_HOURS = 24;
/** The coloured backgrounds a text-only story may use (Tailwind gradient pairs on the client). */
export const STORY_BACKGROUNDS = ['amber', 'rose', 'emerald', 'sky', 'violet', 'stone'] as const;

/** Live stories the viewer may see, grouped by author: the viewer first, then unseen before seen. */
export async function stories(ctx: Ctx, viewerId: string) {
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, s.id AS s_id, s.author_id, s.image AS s_image, s.caption, s.bg, s.visibility AS s_vis, s.created_at AS s_created, s.expires_at,
       EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = $1) AS seen,
       CASE WHEN s.author_id = $1 THEN (SELECT count(*) FROM story_views v WHERE v.story_id = s.id AND v.user_id <> $1)::int ELSE NULL END AS views
     FROM stories s JOIN users u ON u.id = s.author_id LEFT JOIN merchants m ON m.user_id = u.id
     WHERE s.status = 'visible' AND s.expires_at > now() AND u.status = 'active' AND ${NOT_BLOCKED('s.author_id')}
       AND (s.author_id = $1 OR s.visibility = 'public' OR ${FRIEND_OF_VIEWER('s.author_id')})
     ORDER BY s.created_at LIMIT 400`, [viewerId]);
  const groups = new Map<string, { user: ReturnType<typeof publicUser>; mine: boolean; seen: boolean; latest: string; items: unknown[] }>();
  for (const r of rows) {
    let g = groups.get(r.author_id);
    if (!g) { g = { user: publicUser(r), mine: r.author_id === viewerId, seen: true, latest: '', items: [] }; groups.set(r.author_id, g); }
    g.items.push({ id: r.s_id, image: r.s_image || null, caption: r.caption, bg: r.bg || 'amber', visibility: r.s_vis, createdAt: iso(r.s_created), expiresAt: iso(r.expires_at), seen: Boolean(r.seen), views: r.views ?? undefined });
    if (!r.seen && r.author_id !== viewerId) g.seen = false;
    g.latest = iso(r.s_created) || g.latest;
  }
  return [...groups.values()].sort((a, b) => Number(b.mine) - Number(a.mine) || Number(a.seen) - Number(b.seen) || b.latest.localeCompare(a.latest));
}

export async function createStory(ctx: Ctx, userId: string, input: { image?: unknown; caption?: unknown; bg?: unknown; visibility?: unknown }) {
  const picture = image(input.image, 600);
  const caption = clean(input.caption, 280);
  if (!picture && !caption) fail(400, 'EMPTY_POST');
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM stories WHERE author_id = $1 AND created_at > now() - interval '1 day'`, [userId]);
  if (n >= 30) fail(429, 'RATE_LIMITED');
  const bg = STORY_BACKGROUNDS.includes(input.bg as typeof STORY_BACKGROUNDS[number]) ? String(input.bg) : 'amber';
  const visibility = input.visibility === 'public' ? 'public' : 'friends';
  const id = newId('st');
  await ctx.sql.query(`INSERT INTO stories (id, author_id, image, caption, bg, visibility, expires_at) VALUES ($1,$2,$3,$4,$5,$6, now() + interval '${STORY_HOURS} hours')`,
    [id, userId, picture, caption, bg, visibility]);
  return { id };
}

export async function deleteStory(ctx: Ctx, userId: string, id: string) {
  const rows = await ctx.sql.query(`UPDATE stories SET status = 'deleted' WHERE id = $1 AND author_id = $2 RETURNING id`, [id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

/** Marks a story seen (only if the viewer may see it). */
export async function seeStory(ctx: Ctx, viewerId: string, id: string) {
  const [s] = await ctx.sql.query(
    `SELECT s.id FROM stories s JOIN users u ON u.id = s.author_id WHERE s.id = $2 AND s.status = 'visible' AND s.expires_at > now() AND u.status = 'active' AND ${NOT_BLOCKED('s.author_id')}
       AND (s.author_id = $1 OR s.visibility = 'public' OR ${FRIEND_OF_VIEWER('s.author_id')})`, [viewerId, id]);
  if (!s) fail(404, 'NOT_FOUND');
  await ctx.sql.query(`INSERT INTO story_views (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, viewerId]);
}

/** Who saw my story (the author only). */
export async function storyViewers(ctx: Ctx, userId: string, id: string) {
  const [s] = await ctx.sql.query(`SELECT id FROM stories WHERE id = $1 AND author_id = $2`, [id, userId]);
  if (!s) fail(404, 'NOT_FOUND');
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, v.seen_at FROM story_views v JOIN users u ON u.id = v.user_id LEFT JOIN merchants m ON m.user_id = u.id
     WHERE v.story_id = $2 AND v.user_id <> $1 AND u.status = 'active' ORDER BY v.seen_at DESC LIMIT 200`, [userId, id]);
  return rows.map((r) => ({ ...publicUser(r), seenAt: iso(r.seen_at) }));
}

/* ------------------------------------------ discussions ------------------------------------------ */

export const THREAD_CATEGORIES = ['maceration', 'materials', 'cafe', 'review', 'sourcing'] as const;

const THREAD_SELECT = `
  SELECT ${USER_COLUMNS}, t.id AS t_id, t.author_id, t.category, t.title, t.body AS t_body, t.tags, t.solved_reply, t.pinned, t.created_at AS t_created, t.last_at,
    (SELECT count(*) FROM thread_votes tv WHERE tv.thread_id = t.id)::int AS votes,
    EXISTS (SELECT 1 FROM thread_votes tv WHERE tv.thread_id = t.id AND tv.user_id = $1) AS voted,
    (SELECT count(*) FROM thread_replies r JOIN users ru ON ru.id = r.author_id WHERE r.thread_id = t.id AND r.status = 'visible' AND ru.status = 'active')::int AS replies
  FROM threads t JOIN users u ON u.id = t.author_id LEFT JOIN merchants m ON m.user_id = u.id`;
const THREAD_VISIBLE = `t.status = 'visible' AND u.status = 'active' AND ${NOT_BLOCKED('t.author_id')}`;

function threadView(r: Row, viewerId: string) {
  return {
    id: r.t_id, category: r.category, title: r.title, body: r.t_body, tags: Array.isArray(r.tags) ? r.tags : [],
    author: publicUser(r), mine: r.author_id === viewerId, votes: r.votes, voted: Boolean(r.voted), replies: r.replies,
    solvedReply: r.solved_reply || null, pinned: Boolean(r.pinned), createdAt: iso(r.t_created), lastAt: iso(r.last_at),
  };
}

const tagsOf = (value: unknown) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,،#\s]+/) : [])
  .map((t) => clean(t, 30).replace(/^#/, '')).filter(Boolean).slice(0, 5);

/** The salon: newest activity first (pinned on top), or the most voted; optional category and search. */
export async function threads(ctx: Ctx, viewerId: string, options: { category?: unknown; q?: unknown; sort?: unknown; limit?: unknown } = {}) {
  const params: unknown[] = [viewerId];
  let where = THREAD_VISIBLE;
  if (THREAD_CATEGORIES.includes(options.category as typeof THREAD_CATEGORIES[number])) { params.push(options.category); where += ` AND t.category = $${params.length}`; }
  const q = clean(options.q, 80).toLowerCase().replace(/[%_\\]/g, '');
  if (q.length >= 2) { params.push(`%${q}%`); where += ` AND (lower(t.title) LIKE $${params.length} OR lower(t.body) LIKE $${params.length} OR lower(t.tags::text) LIKE $${params.length})`; }
  if (options.sort === 'unsolved') where += ` AND t.solved_reply IS NULL`;
  const order = options.sort === 'top' ? `votes DESC, replies DESC, t.last_at DESC` : `t.pinned DESC, t.last_at DESC`;
  const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 50);
  const rows = await ctx.sql.query(`${THREAD_SELECT} WHERE ${where} ORDER BY ${order} LIMIT ${limit}`, params);
  return rows.map((r) => threadView(r, viewerId));
}

export async function createThread(ctx: Ctx, userId: string, input: { category?: unknown; title?: unknown; body?: unknown; tags?: unknown }) {
  const title = clean(input.title, 160);
  if (title.length < 5) fail(400, 'INVALID_FIELD', 'title');
  const category = THREAD_CATEGORIES.includes(input.category as typeof THREAD_CATEGORIES[number]) ? String(input.category) : 'cafe';
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM threads WHERE author_id = $1 AND created_at > now() - interval '1 hour'`, [userId]);
  if (n >= 10) fail(429, 'RATE_LIMITED');
  const id = newId('t');
  await ctx.sql.query(`INSERT INTO threads (id, author_id, category, title, body, tags) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, userId, category, title, clean(input.body, 6000), JSON.stringify(tagsOf(input.tags))]);
  return thread(ctx, userId, id);
}

/** One thread with its replies (oldest first, the solving reply flagged). */
export async function thread(ctx: Ctx, viewerId: string, id: string) {
  const [row] = await ctx.sql.query(`${THREAD_SELECT} WHERE t.id = $2 AND ${THREAD_VISIBLE}`, [viewerId, id]);
  if (!row) fail(404, 'NOT_FOUND');
  const replies = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, r.id AS r_id, r.body AS r_body, r.created_at AS r_created, r.author_id FROM thread_replies r JOIN users u ON u.id = r.author_id LEFT JOIN merchants m ON m.user_id = u.id
     WHERE r.thread_id = $2 AND r.status = 'visible' AND u.status = 'active' AND ${NOT_BLOCKED('r.author_id')} ORDER BY r.created_at LIMIT 500`, [viewerId, id]);
  return {
    ...threadView(row, viewerId),
    replyList: replies.map((r) => ({ id: r.r_id, body: r.r_body, createdAt: iso(r.r_created), author: publicUser(r), mine: r.author_id === viewerId, accepted: r.r_id === row.solved_reply })),
  };
}

export async function replyThread(ctx: Ctx, userId: string, id: string, body: unknown) {
  const t = await thread(ctx, userId, id);
  const text = clean(body, 4000);
  if (!text) fail(400, 'EMPTY_COMMENT');
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM thread_replies WHERE author_id = $1 AND created_at > now() - interval '1 hour'`, [userId]);
  if (n >= 60) fail(429, 'RATE_LIMITED');
  await ctx.sql.query(`INSERT INTO thread_replies (id, thread_id, author_id, body) VALUES ($1,$2,$3,$4)`, [newId('tr'), id, userId, text]);
  await ctx.sql.query(`UPDATE threads SET last_at = clock_timestamp() WHERE id = $1`, [id]);
  await notify(ctx, t.author.id, 'thread_reply', userId, id);
  return thread(ctx, userId, id);
}

export async function voteThread(ctx: Ctx, userId: string, id: string, on: unknown) {
  await thread(ctx, userId, id);
  if (on === false) await ctx.sql.query(`DELETE FROM thread_votes WHERE thread_id = $1 AND user_id = $2`, [id, userId]);
  else await ctx.sql.query(`INSERT INTO thread_votes (thread_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, userId]);
  return thread(ctx, userId, id);
}

/** The thread's author marks (or clears with null) the reply that solved it. */
export async function solveThread(ctx: Ctx, userId: string, id: string, replyId: unknown) {
  const t = await thread(ctx, userId, id);
  if (!t.mine) fail(403, 'FORBIDDEN');
  let value: string | null = null;
  if (typeof replyId === 'string' && replyId) {
    const reply = t.replyList.find((r) => r.id === replyId);
    if (!reply) fail(404, 'NOT_FOUND');
    value = replyId;
    if (reply && reply.author.id !== userId) await notify(ctx, reply.author.id, 'reply_accepted', userId, id);
  }
  await ctx.sql.query(`UPDATE threads SET solved_reply = $1 WHERE id = $2`, [value, id]);
  return thread(ctx, userId, id);
}

export async function deleteThread(ctx: Ctx, userId: string, id: string) {
  const rows = await ctx.sql.query(`UPDATE threads SET status = 'deleted' WHERE id = $1 AND author_id = $2 RETURNING id`, [id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

export async function deleteReply(ctx: Ctx, userId: string, replyId: string) {
  // The reply's author or the thread's author may remove it.
  const rows = await ctx.sql.query(
    `UPDATE thread_replies r SET status = 'deleted' FROM threads t WHERE r.id = $1 AND t.id = r.thread_id AND (r.author_id = $2 OR t.author_id = $2) RETURNING r.id`, [replyId, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

/* ----------------------------------------- product reviews ----------------------------------------- */

const SKU = /^[A-Za-z0-9._:-]{1,80}$/;
const PAID = `('paid','processing','shipped','delivered')`;
const LONGEVITY = ['', 'weak', 'moderate', 'long', 'very_long'];
const SILLAGE = ['', 'soft', 'moderate', 'strong', 'enormous'];

const sku = (value: unknown) => {
  const text = String(value || '').trim();
  if (!SKU.test(text)) fail(400, 'INVALID_FIELD', 'sku');
  return text;
};

/** Did this member really pay for this product? (Orders keep their lines as `[{ sku, qty, … }]`.) */
export async function boughtProduct(ctx: Ctx, userId: string, productSku: string) {
  const [row] = await ctx.sql.query(`SELECT 1 FROM orders WHERE buyer_id = $1 AND status IN ${PAID} AND items @> $2::jsonb LIMIT 1`, [userId, JSON.stringify([{ sku: productSku }])]);
  return Boolean(row);
}

/** A product's reviews for any visitor (viewer optional), the real average and the 1–5 spread. */
export async function reviews(ctx: Ctx, viewerId: string | null, productSku: unknown) {
  const code = sku(productSku);
  const viewer = viewerId || '';
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, r.id AS r_id, r.user_id, r.rating, r.title, r.body AS r_body, r.longevity, r.sillage, r.verified, r.created_at AS r_created, r.updated_at AS r_updated,
       (SELECT count(*) FROM review_helpful h WHERE h.review_id = r.id)::int AS helpful,
       EXISTS (SELECT 1 FROM review_helpful h WHERE h.review_id = r.id AND h.user_id = $1) AS voted
     FROM product_reviews r JOIN users u ON u.id = r.user_id LEFT JOIN merchants m ON m.user_id = u.id
     WHERE r.sku = $2 AND r.status = 'visible' AND u.status = 'active' AND ${NOT_BLOCKED('r.user_id')}
     ORDER BY (r.user_id = $1) DESC, r.verified DESC, helpful DESC, r.created_at DESC LIMIT 200`, [viewer, code]);
  const list = rows.map((r) => ({
    id: r.r_id, rating: r.rating, title: r.title, body: r.r_body, longevity: r.longevity, sillage: r.sillage, verified: Boolean(r.verified),
    helpful: r.helpful, voted: Boolean(r.voted), mine: r.user_id === viewer, createdAt: iso(r.r_created), updatedAt: iso(r.r_updated),
    author: (({ id, handle, name, avatar, country }) => ({ id, handle, name, avatar, country }))(publicUser(r)),
  }));
  const spread = [0, 0, 0, 0, 0];
  for (const r of list) spread[r.rating - 1] += 1;
  const count = list.length;
  const average = count ? Math.round((list.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  return { sku: code, count, average, spread, reviews: list, canVerify: viewerId ? await boughtProduct(ctx, viewerId, code) : false };
}

/** Write or update my review of a product (one per member and product). */
export async function saveReview(ctx: Ctx, userId: string, productSku: unknown, input: { rating?: unknown; title?: unknown; body?: unknown; longevity?: unknown; sillage?: unknown }) {
  const code = sku(productSku);
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'INVALID_FIELD', 'rating');
  const body = clean(input.body, 3000);
  if (body.length < 10) fail(400, 'INVALID_FIELD', 'body');
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM product_reviews WHERE user_id = $1 AND updated_at > now() - interval '1 day'`, [userId]);
  if (n >= 20) fail(429, 'RATE_LIMITED');
  const verified = await boughtProduct(ctx, userId, code);
  await ctx.sql.query(
    `INSERT INTO product_reviews (id, sku, user_id, rating, title, body, longevity, sillage, verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (sku, user_id) DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body, longevity = EXCLUDED.longevity,
       sillage = EXCLUDED.sillage, verified = EXCLUDED.verified, status = 'visible', updated_at = clock_timestamp()`,
    [newId('rv'), code, userId, rating, clean(input.title, 120), body,
      LONGEVITY.includes(String(input.longevity || '')) ? String(input.longevity || '') : '',
      SILLAGE.includes(String(input.sillage || '')) ? String(input.sillage || '') : '', verified]);
  return reviews(ctx, userId, code);
}

export async function deleteReview(ctx: Ctx, userId: string, id: string) {
  const rows = await ctx.sql.query(`DELETE FROM product_reviews WHERE id = $1 AND user_id = $2 RETURNING sku`, [id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

/** «مفيد»: one vote per member, not on one's own review. */
export async function helpfulReview(ctx: Ctx, userId: string, id: string, on: unknown) {
  const [r] = await ctx.sql.query(`SELECT sku, user_id FROM product_reviews WHERE id = $1 AND status = 'visible'`, [id]);
  if (!r) fail(404, 'NOT_FOUND');
  if (r.user_id === userId) fail(400, 'INVALID_TARGET');
  if (on === false) await ctx.sql.query(`DELETE FROM review_helpful WHERE review_id = $1 AND user_id = $2`, [id, userId]);
  else await ctx.sql.query(`INSERT INTO review_helpful (review_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, userId]);
  return reviews(ctx, userId, r.sku);
}
