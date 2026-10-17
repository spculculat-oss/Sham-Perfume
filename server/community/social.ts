/**
 * «بوابة السوشيال» — the public feed, profiles, reactions, comments, friends, blocking, reports and
 * notifications. Visibility is enforced in SQL: a friends-only post is never sent to someone who is not
 * a friend, and blocked people disappear from each other's feed, search and profile.
 */
import type { Row } from './db';
import { newId } from './crypto';
import { USER_COLUMNS, USER_FROM, areFriends, clean, fail, image, isBlocked, publicUser, type Ctx } from './service';

export const REACTIONS = ['like', 'love', 'wow', 'haha', 'sad', 'fire'] as const;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const PAGE = 20;

async function notify(ctx: Ctx, userId: string, kind: string, actorId: string, ref = '') {
  if (userId === actorId) return;
  await ctx.sql.query(`INSERT INTO notifications (id, user_id, kind, actor_id, ref) VALUES ($1,$2,$3,$4,$5)`, [newId('n'), userId, kind, actorId, ref]);
}

/* --------------------------------------------- posts --------------------------------------------- */

const POST_SELECT = `
  SELECT ${USER_COLUMNS}, p.id AS post_id, p.author_id, p.body, p.image, p.recipe_id, p.visibility, p.created_at AS post_created, p.edited_at,
    (SELECT count(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'visible')::int AS comments,
    (SELECT coalesce(json_object_agg(kind, n), '{}') FROM (SELECT kind, count(*)::int AS n FROM reactions r WHERE r.post_id = p.id GROUP BY kind) k) AS reaction_counts,
    (SELECT kind FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS my_reaction,
    rc.title AS recipe_title, rc.data AS recipe_data, rc.visibility AS recipe_visibility
  FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN merchants m ON m.user_id = u.id LEFT JOIN recipes rc ON rc.id = p.recipe_id`;

/** Rows the viewer may see: visible, author active, not blocked either way, public or a friend's (or own). */
const VISIBLE = `p.status = 'visible' AND u.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = p.author_id) OR (b.blocker = p.author_id AND b.blocked = $1))
  AND (p.visibility = 'public' OR p.author_id = $1 OR EXISTS (
    SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.user_a = $1 AND f.user_b = p.author_id) OR (f.user_b = $1 AND f.user_a = p.author_id))))`;

function postView(row: Row, viewerId: string) {
  const recipeVisible = row.recipe_title && (row.recipe_visibility !== 'private' || row.author_id === viewerId);
  return {
    id: row.post_id, body: row.body, image: row.image || null, visibility: row.visibility, createdAt: iso(row.post_created), editedAt: iso(row.edited_at),
    author: publicUser(row), mine: row.author_id === viewerId, comments: row.comments,
    reactions: row.reaction_counts || {}, myReaction: row.my_reaction || null,
    recipe: recipeVisible ? { id: row.recipe_id, title: row.recipe_title, data: row.recipe_data } : null,
  };
}

/** The home feed: friends and the public, newest first, 20 at a time (`before` = createdAt of the last post). */
export async function feed(ctx: Ctx, viewerId: string, options: { before?: unknown; scope?: unknown } = {}) {
  const params: unknown[] = [viewerId];
  let where = VISIBLE;
  if (typeof options.before === 'string' && !Number.isNaN(Date.parse(options.before))) { params.push(options.before); where += ` AND p.created_at < $${params.length}`; }
  if (options.scope === 'friends') where += ` AND (p.author_id = $1 OR EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.user_a = $1 AND f.user_b = p.author_id) OR (f.user_b = $1 AND f.user_a = p.author_id))))`;
  const rows = await ctx.sql.query(`${POST_SELECT} WHERE ${where} ORDER BY p.created_at DESC LIMIT ${PAGE}`, params);
  return rows.map((r) => postView(r, viewerId));
}

export async function createPost(ctx: Ctx, authorId: string, input: { body?: unknown; image?: unknown; visibility?: unknown; recipeId?: unknown }) {
  const body = clean(input.body, 5000);
  const picture = image(input.image, 500);
  let recipeId: string | null = null;
  if (typeof input.recipeId === 'string' && input.recipeId) {
    const [r] = await ctx.sql.query(`SELECT id FROM recipes WHERE id = $1 AND user_id = $2`, [input.recipeId, authorId]);
    if (!r) fail(404, 'NOT_FOUND');
    recipeId = r.id;
  }
  if (!body && !picture && !recipeId) fail(400, 'EMPTY_POST');
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM posts WHERE author_id = $1 AND created_at > now() - interval '1 hour'`, [authorId]);
  if (n >= 30) fail(429, 'RATE_LIMITED');
  const id = newId('p');
  const visibility = input.visibility === 'friends' ? 'friends' : 'public';
  await ctx.sql.query(`INSERT INTO posts (id, author_id, body, image, recipe_id, visibility) VALUES ($1,$2,$3,$4,$5,$6)`, [id, authorId, body, picture, recipeId, visibility]);
  return getPost(ctx, authorId, id);
}

export async function getPost(ctx: Ctx, viewerId: string, id: string) {
  const [row] = await ctx.sql.query(`${POST_SELECT} WHERE p.id = $2 AND ${VISIBLE}`, [viewerId, id]);
  if (!row) fail(404, 'NOT_FOUND');
  return postView(row, viewerId);
}

export async function editPost(ctx: Ctx, userId: string, id: string, input: { body?: unknown; visibility?: unknown }) {
  const rows = await ctx.sql.query(
    `UPDATE posts SET body = coalesce($1, body), visibility = coalesce($2, visibility), edited_at = now() WHERE id = $3 AND author_id = $4 AND status = 'visible' RETURNING id`,
    [input.body !== undefined ? clean(input.body, 5000) : null, input.visibility === 'friends' || input.visibility === 'public' ? input.visibility : null, id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  return getPost(ctx, userId, id);
}

export async function deletePost(ctx: Ctx, userId: string, id: string) {
  const rows = await ctx.sql.query(`UPDATE posts SET status = 'deleted' WHERE id = $1 AND author_id = $2 RETURNING id`, [id, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

export async function react(ctx: Ctx, userId: string, postId: string, kind: unknown) {
  const post = await getPost(ctx, userId, postId); // visibility check
  if (kind === null || kind === '' || kind === undefined) {
    await ctx.sql.query(`DELETE FROM reactions WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
  } else {
    if (!REACTIONS.includes(kind as typeof REACTIONS[number])) fail(400, 'INVALID_REACTION');
    await ctx.sql.query(`INSERT INTO reactions (post_id, user_id, kind) VALUES ($1,$2,$3) ON CONFLICT (post_id, user_id) DO UPDATE SET kind = EXCLUDED.kind`, [postId, userId, kind]);
    if (!post.myReaction) await notify(ctx, post.author.id, 'reaction', userId, postId);
  }
  return getPost(ctx, userId, postId);
}

export async function comments(ctx: Ctx, viewerId: string, postId: string) {
  await getPost(ctx, viewerId, postId);
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, c.id AS comment_id, c.body AS comment_body, c.created_at AS comment_created, c.author_id FROM comments c JOIN users u ON u.id = c.author_id LEFT JOIN merchants m ON m.user_id = u.id
     WHERE c.post_id = $2 AND c.status = 'visible' AND u.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = c.author_id) OR (b.blocker = c.author_id AND b.blocked = $1))
     ORDER BY c.created_at LIMIT 300`, [viewerId, postId]);
  return rows.map((r) => ({ id: r.comment_id, body: r.comment_body, createdAt: iso(r.comment_created), author: publicUser(r), mine: r.author_id === viewerId }));
}

export async function addComment(ctx: Ctx, userId: string, postId: string, body: unknown) {
  const post = await getPost(ctx, userId, postId);
  const text = clean(body, 2000);
  if (!text) fail(400, 'EMPTY_COMMENT');
  await ctx.sql.query(`INSERT INTO comments (id, post_id, author_id, body) VALUES ($1,$2,$3,$4)`, [newId('c'), postId, userId, text]);
  await notify(ctx, post.author.id, 'comment', userId, postId);
  return comments(ctx, userId, postId);
}

export async function deleteComment(ctx: Ctx, userId: string, commentId: string) {
  // The comment's author or the post's author may remove it.
  const rows = await ctx.sql.query(
    `UPDATE comments c SET status = 'deleted' FROM posts p WHERE c.id = $1 AND p.id = c.post_id AND (c.author_id = $2 OR p.author_id = $2) RETURNING c.id`, [commentId, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
}

/* -------------------------------------------- people -------------------------------------------- */

const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

export async function relation(ctx: Ctx, viewerId: string, otherId: string): Promise<'self' | 'friends' | 'requested' | 'incoming' | 'blocked' | 'none'> {
  if (viewerId === otherId) return 'self';
  const [blocked] = await ctx.sql.query(`SELECT 1 FROM blocks WHERE blocker = $1 AND blocked = $2`, [viewerId, otherId]);
  if (blocked) return 'blocked';
  const [x, y] = pair(viewerId, otherId);
  const [f] = await ctx.sql.query(`SELECT status, requester FROM friendships WHERE user_a = $1 AND user_b = $2`, [x, y]);
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester === viewerId ? 'requested' : 'incoming';
}

export async function profile(ctx: Ctx, viewerId: string, handle: string) {
  const [row] = await ctx.sql.query(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE u.handle = $1 AND u.status = 'active'`, [clean(handle, 40).toLowerCase()]);
  if (!row) fail(404, 'NOT_FOUND');
  const [blockedMe] = await ctx.sql.query(`SELECT 1 FROM blocks WHERE blocker = $1 AND blocked = $2`, [row.id, viewerId]);
  if (blockedMe) fail(404, 'NOT_FOUND');
  const [counts] = await ctx.sql.query(
    `SELECT (SELECT count(*) FROM friendships WHERE (user_a = $1 OR user_b = $1) AND status = 'accepted')::int AS friends,
            (SELECT count(*) FROM posts WHERE author_id = $1 AND status = 'visible')::int AS posts,
            (SELECT count(*) FROM recipes WHERE user_id = $1 AND visibility = 'public')::int AS recipes`, [row.id]);
  const posts = await ctx.sql.query(`${POST_SELECT} WHERE p.author_id = $2 AND ${VISIBLE} ORDER BY p.created_at DESC LIMIT ${PAGE}`, [viewerId, row.id]);
  const friends = row.id === viewerId || (await areFriends(ctx.sql, row.id, viewerId));
  const recipes = await ctx.sql.query(
    `SELECT id, title, data, updated_at FROM recipes WHERE user_id = $1 AND (visibility = 'public' OR ($2 AND visibility = 'friends') OR user_id = $3) ORDER BY updated_at DESC LIMIT 30`,
    [row.id, friends, viewerId]);
  return {
    user: publicUser(row), relation: await relation(ctx, viewerId, row.id), counts,
    posts: posts.map((p) => postView(p, viewerId)),
    recipes: recipes.map((r) => ({ id: r.id, title: r.title, data: r.data, updatedAt: iso(r.updated_at) })),
  };
}

/** People search by name or @handle (blocked people excluded both ways). */
export async function searchPeople(ctx: Ctx, viewerId: string, query: unknown) {
  const q = clean(query, 60).replace(/^@/, '').toLowerCase();
  if (q.length < 2) return [];
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE u.status = 'active' AND u.id <> $1
       AND (lower(u.name) LIKE $2 OR u.handle LIKE $2)
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = $1))
     ORDER BY (u.handle = $3) DESC, u.last_seen DESC LIMIT 25`, [viewerId, `%${q.replace(/[%_\\]/g, '')}%`, q]);
  return rows.map(publicUser);
}

/** «أشخاص قد تعرفهم»: friends of friends first, then active people from the same country. */
export async function suggestions(ctx: Ctx, viewerId: string) {
  const rows = await ctx.sql.query(
    `WITH mine AS (SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS id FROM friendships WHERE (user_a = $1 OR user_b = $1)),
          fof AS (SELECT CASE WHEN f.user_a = mine.id THEN f.user_b ELSE f.user_a END AS id, count(*) AS n
                  FROM friendships f JOIN mine ON (f.user_a = mine.id OR f.user_b = mine.id) WHERE f.status = 'accepted' GROUP BY 1)
     SELECT ${USER_COLUMNS}, coalesce(fof.n, 0)::int AS mutual FROM ${USER_FROM} LEFT JOIN fof ON fof.id = u.id
     WHERE u.status = 'active' AND u.id <> $1 AND u.id NOT IN (SELECT id FROM mine)
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = $1 AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = $1))
     ORDER BY mutual DESC, (u.country = (SELECT country FROM users WHERE id = $1)) DESC, u.last_seen DESC LIMIT 12`, [viewerId]);
  return rows.map((r) => ({ ...publicUser(r), mutual: r.mutual }));
}

export async function requestFriend(ctx: Ctx, userId: string, otherId: string) {
  if (userId === otherId) fail(400, 'INVALID_TARGET');
  const [other] = await ctx.sql.query(`SELECT id FROM users WHERE id = $1 AND status = 'active'`, [otherId]);
  if (!other || (await isBlocked(ctx.sql, userId, otherId))) fail(404, 'NOT_FOUND');
  const [x, y] = pair(userId, otherId);
  const [existing] = await ctx.sql.query(`SELECT status, requester FROM friendships WHERE user_a = $1 AND user_b = $2`, [x, y]);
  if (existing?.status === 'accepted') return 'friends';
  if (existing && existing.requester !== userId) return acceptFriend(ctx, userId, otherId); // both asked: friends
  if (!existing) {
    const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM friendships WHERE requester = $1 AND status = 'pending' AND created_at > now() - interval '1 day'`, [userId]);
    if (n >= 100) fail(429, 'RATE_LIMITED');
    await ctx.sql.query(`INSERT INTO friendships (user_a, user_b, requester) VALUES ($1,$2,$3)`, [x, y, userId]);
    await notify(ctx, otherId, 'friend_request', userId);
  }
  return 'requested';
}

export async function acceptFriend(ctx: Ctx, userId: string, otherId: string) {
  const [x, y] = pair(userId, otherId);
  const rows = await ctx.sql.query(
    `UPDATE friendships SET status = 'accepted', accepted_at = now() WHERE user_a = $1 AND user_b = $2 AND status = 'pending' AND requester <> $3 RETURNING 1`, [x, y, userId]);
  if (!rows.length) fail(404, 'NOT_FOUND');
  await notify(ctx, otherId, 'friend_accepted', userId);
  return 'friends' as const;
}

/** Decline a request, cancel mine, or unfriend. */
export async function removeFriend(ctx: Ctx, userId: string, otherId: string) {
  const [x, y] = pair(userId, otherId);
  await ctx.sql.query(`DELETE FROM friendships WHERE user_a = $1 AND user_b = $2`, [x, y]);
  return 'none' as const;
}

export async function friends(ctx: Ctx, userId: string) {
  const list = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, f.status, f.requester FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
     LEFT JOIN merchants m ON m.user_id = u.id WHERE (f.user_a = $1 OR f.user_b = $1) AND u.status = 'active' ORDER BY u.last_seen DESC`, [userId]);
  return {
    friends: list.filter((r) => r.status === 'accepted').map(publicUser),
    incoming: list.filter((r) => r.status === 'pending' && r.requester !== userId).map(publicUser),
    outgoing: list.filter((r) => r.status === 'pending' && r.requester === userId).map(publicUser),
  };
}

export async function block(ctx: Ctx, userId: string, otherId: string) {
  if (userId === otherId) fail(400, 'INVALID_TARGET');
  await ctx.sql.query(`INSERT INTO blocks (blocker, blocked) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, otherId]);
  await removeFriend(ctx, userId, otherId);
}

export async function unblock(ctx: Ctx, userId: string, otherId: string) {
  await ctx.sql.query(`DELETE FROM blocks WHERE blocker = $1 AND blocked = $2`, [userId, otherId]);
}

export async function blockedList(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(`SELECT ${USER_COLUMNS} FROM blocks b JOIN users u ON u.id = b.blocked LEFT JOIN merchants m ON m.user_id = u.id WHERE b.blocker = $1`, [userId]);
  return rows.map(publicUser);
}

const REPORT_KINDS = ['post', 'comment', 'user', 'message', 'product', 'store'];
export async function report(ctx: Ctx, userId: string, input: { kind?: unknown; id?: unknown; reason?: unknown }) {
  const kind = String(input.kind);
  if (!REPORT_KINDS.includes(kind)) fail(400, 'INVALID_FIELD', 'kind');
  const id = clean(input.id, 80);
  if (!id) fail(400, 'INVALID_FIELD', 'id');
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1 AND created_at > now() - interval '1 day'`, [userId]);
  if (n >= 50) fail(429, 'RATE_LIMITED');
  await ctx.sql.query(`INSERT INTO reports (id, reporter_id, target_kind, target_id, reason) VALUES ($1,$2,$3,$4,$5)`, [newId('rp'), userId, kind, id, clean(input.reason, 1000)]);
}

/* ------------------------------------------ notifications ------------------------------------------ */

export async function notifications(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(
    `SELECT ${USER_COLUMNS}, n.id AS n_id, n.kind AS n_kind, n.ref AS n_ref, n.created_at AS n_created, n.read_at FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
     LEFT JOIN merchants m ON m.user_id = u.id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 60`, [userId]);
  return rows.map((r) => ({ id: r.n_id, kind: r.n_kind, ref: r.n_ref, createdAt: iso(r.n_created), read: Boolean(r.read_at), actor: r.handle ? publicUser(r) : null }));
}

export async function readNotifications(ctx: Ctx, userId: string) {
  await ctx.sql.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
}
