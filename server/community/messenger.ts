/**
 * «ماسنجر شام» — direct and group conversations. Every message body and attachment is encrypted at rest
 * (AES-256-GCM, server key); members read them through the API, the administration through the audited
 * admin API, nobody else. Features: text, emoji, pictures, voice notes, sharing a recipe, replies,
 * editing, «delete for everyone», reactions, read receipts (✓✓), typing indicator, online status,
 * unread counters, mute, groups (create, rename, add, leave), and blocking.
 * Serverless-friendly: the browser polls `pulse` (one cheap query) and fetches only what changed.
 */
import type { Row } from './db';
import { newId } from './crypto';
import { USER_COLUMNS, areFriends, audio, clean, fail, image, isBlocked, publicUser, type Ctx } from './service';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const KINDS = ['text', 'image', 'voice', 'recipe'] as const;
export const MESSAGE_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🌹'];
const EDIT_WINDOW_MS = 24 * 3_600_000;
const TYPING_MS = 6_000;

async function membership(ctx: Ctx, userId: string, conversationId: string) {
  const [m] = await ctx.sql.query(
    `SELECT mb.*, c.kind, c.title FROM members mb JOIN conversations c ON c.id = mb.conversation_id WHERE mb.conversation_id = $1 AND mb.user_id = $2 AND mb.left_at IS NULL`,
    [conversationId, userId]);
  if (!m) fail(404, 'NOT_FOUND');
  return m;
}

async function membersOf(ctx: Ctx, conversationId: string) {
  return ctx.sql.query(
    `SELECT ${USER_COLUMNS}, mb.role AS member_role, mb.last_read_at, mb.typing_until FROM members mb JOIN users u ON u.id = mb.user_id
     LEFT JOIN merchants m ON m.user_id = u.id WHERE mb.conversation_id = $1 AND mb.left_at IS NULL`, [conversationId]);
}

/** The conversation list: last message preview, unread count, who is typing, the other person's status. */
export async function conversations(ctx: Ctx, userId: string) {
  const rows = await ctx.sql.query(
    `SELECT c.id, c.kind, c.title, c.last_at, mb.muted, mb.last_read_at,
       (SELECT count(*) FROM messages x WHERE x.conversation_id = c.id AND x.created_at > mb.last_read_at AND x.sender_id <> $1 AND x.deleted_at IS NULL)::int AS unread,
       lm.id AS lm_id, lm.kind AS lm_kind, lm.body_enc AS lm_body, lm.sender_id AS lm_sender, lm.deleted_at AS lm_deleted, lm.created_at AS lm_at
     FROM members mb JOIN conversations c ON c.id = mb.conversation_id
     LEFT JOIN LATERAL (SELECT * FROM messages x WHERE x.conversation_id = c.id ORDER BY x.created_at DESC LIMIT 1) lm ON true
     WHERE mb.user_id = $1 AND mb.left_at IS NULL ORDER BY c.last_at DESC LIMIT 200`, [userId]);
  if (!rows.length) return [];
  const people = await ctx.sql.query(
    `SELECT mb.conversation_id, mb.typing_until, ${USER_COLUMNS} FROM members mb JOIN users u ON u.id = mb.user_id LEFT JOIN merchants m ON m.user_id = u.id
     WHERE mb.conversation_id = ANY($1) AND mb.left_at IS NULL AND mb.user_id <> $2`, [rows.map((r) => r.id), userId]);
  const now = Date.now();
  return rows.map((r) => {
    const others = people.filter((p) => p.conversation_id === r.id);
    const preview = r.lm_id ? (r.lm_deleted ? '' : r.lm_kind === 'text' ? ctx.vault.open(r.lm_body).slice(0, 120) : '') : '';
    return {
      id: r.id, kind: r.kind, title: r.kind === 'group' ? r.title : others[0]?.name || '', muted: r.muted, unread: r.unread, lastAt: iso(r.last_at),
      members: others.map(publicUser),
      typing: others.filter((p) => p.typing_until && new Date(p.typing_until).getTime() > now).map((p) => p.name),
      last: r.lm_id ? { kind: r.lm_kind, text: preview, mine: r.lm_sender === userId, deleted: Boolean(r.lm_deleted), at: iso(r.lm_at) } : null,
    };
  });
}

/** Opens (or creates) the direct conversation with another member. Blocked people cannot write. */
export async function openDirect(ctx: Ctx, userId: string, otherId: string) {
  if (userId === otherId) fail(400, 'INVALID_TARGET');
  const [other] = await ctx.sql.query(`SELECT id FROM users WHERE id = $1 AND status = 'active'`, [otherId]);
  if (!other || (await isBlocked(ctx.sql, userId, otherId))) fail(404, 'NOT_FOUND');
  const key = [userId, otherId].sort().join('|');
  const [existing] = await ctx.sql.query(`SELECT id FROM conversations WHERE direct_key = $1`, [key]);
  if (existing) {
    await ctx.sql.query(`UPDATE members SET left_at = NULL WHERE conversation_id = $1 AND user_id = $2`, [existing.id, userId]);
    return existing.id as string;
  }
  const id = newId('cv');
  await ctx.sql.tx(async (t) => {
    await t.query(`INSERT INTO conversations (id, kind, direct_key, created_by) VALUES ($1, 'direct', $2, $3) ON CONFLICT (direct_key) DO NOTHING`, [id, key, userId]);
    const [row] = await t.query(`SELECT id FROM conversations WHERE direct_key = $1`, [key]);
    if (row.id === id) await t.query(`INSERT INTO members (conversation_id, user_id) VALUES ($1,$2), ($1,$3)`, [id, userId, otherId]);
  });
  const [row] = await ctx.sql.query(`SELECT id FROM conversations WHERE direct_key = $1`, [key]);
  return row.id as string;
}

/** A group with friends (up to 100 members). */
export async function createGroup(ctx: Ctx, userId: string, input: { title?: unknown; members?: unknown }) {
  const title = clean(input.title, 80) || 'مجموعة';
  const ids = [...new Set((Array.isArray(input.members) ? input.members : []).map(String))].filter((id) => id !== userId).slice(0, 99);
  if (!ids.length) fail(400, 'NO_MEMBERS');
  for (const id of ids) if (!(await areFriends(ctx.sql, userId, id))) fail(403, 'NOT_FRIENDS');
  const id = newId('cv');
  await ctx.sql.tx(async (t) => {
    await t.query(`INSERT INTO conversations (id, kind, title, created_by) VALUES ($1, 'group', $2, $3)`, [id, title, userId]);
    await t.query(`INSERT INTO members (conversation_id, user_id, role) VALUES ($1, $2, 'owner')`, [id, userId]);
    for (const member of ids) await t.query(`INSERT INTO members (conversation_id, user_id) VALUES ($1, $2)`, [id, member]);
    await t.query(`INSERT INTO messages (id, conversation_id, sender_id, kind, body_enc) VALUES ($1, $2, $3, 'system', $4)`, [newId('msg'), id, userId, ctx.vault.seal('group_created')]);
  });
  return id;
}

export async function updateGroup(ctx: Ctx, userId: string, conversationId: string, input: { title?: unknown; add?: unknown; leave?: unknown; muted?: unknown }) {
  const m = await membership(ctx, userId, conversationId);
  if (typeof input.muted === 'boolean') await ctx.sql.query(`UPDATE members SET muted = $1 WHERE conversation_id = $2 AND user_id = $3`, [input.muted, conversationId, userId]);
  if (m.kind !== 'group') {
    if (input.leave === true) await ctx.sql.query(`UPDATE members SET left_at = now() WHERE conversation_id = $1 AND user_id = $2`, [conversationId, userId]); // hide the chat
    return;
  }
  if (input.title !== undefined) {
    const title = clean(input.title, 80);
    if (title) {
      await ctx.sql.query(`UPDATE conversations SET title = $1 WHERE id = $2`, [title, conversationId]);
      await systemMessage(ctx, conversationId, userId, `renamed:${title}`);
    }
  }
  if (Array.isArray(input.add)) {
    for (const id of input.add.map(String).slice(0, 50)) {
      if (!(await areFriends(ctx.sql, userId, id))) fail(403, 'NOT_FRIENDS');
      await ctx.sql.query(
        `INSERT INTO members (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT (conversation_id, user_id) DO UPDATE SET left_at = NULL, joined_at = clock_timestamp()`, [conversationId, id]);
      await systemMessage(ctx, conversationId, userId, `added:${id}`);
    }
  }
  if (input.leave === true) {
    await ctx.sql.query(`UPDATE members SET left_at = now() WHERE conversation_id = $1 AND user_id = $2`, [conversationId, userId]);
    await systemMessage(ctx, conversationId, userId, 'left');
  }
}

async function systemMessage(ctx: Ctx, conversationId: string, userId: string, text: string) {
  await ctx.sql.query(`INSERT INTO messages (id, conversation_id, sender_id, kind, body_enc) VALUES ($1,$2,$3,'system',$4)`, [newId('msg'), conversationId, userId, ctx.vault.seal(text)]);
  await ctx.sql.query(`UPDATE conversations SET last_at = clock_timestamp() WHERE id = $1`, [conversationId]);
}

function messageView(ctx: Ctx, row: Row, viewerId: string, reactions: Row[], replies: Map<string, Row>) {
  const deleted = Boolean(row.deleted_at);
  const reply = row.reply_to ? replies.get(row.reply_to) : undefined;
  const mine = reactions.filter((r) => r.message_id === row.id);
  const counts: Record<string, number> = {};
  for (const r of mine) counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  return {
    id: row.id, kind: row.kind, senderId: row.sender_id, mine: row.sender_id === viewerId, createdAt: iso(row.created_at), editedAt: iso(row.edited_at), deleted,
    text: deleted ? '' : ctx.vault.open(row.body_enc),
    attachment: deleted ? null : (row.attachment_enc ? ctx.vault.open(row.attachment_enc) : null),
    replyTo: reply ? { id: reply.id, senderId: reply.sender_id, kind: reply.kind, text: reply.deleted_at ? '' : ctx.vault.open(reply.body_enc).slice(0, 140) } : null,
    reactions: counts, myReaction: mine.find((r) => r.user_id === viewerId)?.emoji || null,
  };
}

/**
 * Messages of a conversation: the latest 40, older ones with `before`, or only what changed `since` a time
 * (new, edited or deleted messages) for polling. Also returns members with their read position.
 */
export async function messages(ctx: Ctx, userId: string, conversationId: string, options: { before?: unknown; since?: unknown } = {}) {
  const m = await membership(ctx, userId, conversationId);
  const params: unknown[] = [conversationId, m.joined_at];
  let where = `conversation_id = $1 AND created_at >= $2`;
  let order = 'DESC';
  if (typeof options.since === 'string' && !Number.isNaN(Date.parse(options.since))) {
    params.push(options.since);
    where += ` AND touched_at > $3`;
    order = 'ASC';
  } else if (typeof options.before === 'string' && !Number.isNaN(Date.parse(options.before))) {
    params.push(options.before);
    where += ` AND created_at < $3`;
  }
  // Taken before reading, so a message written meanwhile is picked up by the next `since` poll.
  const [{ server_now }] = await ctx.sql.query(`SELECT clock_timestamp() AS server_now`);
  const rows = await ctx.sql.query(`SELECT * FROM messages WHERE ${where} ORDER BY ${order === 'ASC' ? 'touched_at' : 'created_at'} ${order} LIMIT ${order === 'ASC' ? 200 : 40}`, params);
  const list = order === 'DESC' ? rows.reverse() : rows;
  const ids = list.map((r) => r.id);
  const replyIds = list.map((r) => r.reply_to).filter(Boolean);
  const [reactions, replyRows, people] = await Promise.all([
    ids.length ? ctx.sql.query(`SELECT * FROM message_reactions WHERE message_id = ANY($1)`, [ids]) : Promise.resolve([] as Row[]),
    replyIds.length ? ctx.sql.query(`SELECT id, sender_id, kind, body_enc, deleted_at FROM messages WHERE id = ANY($1)`, [replyIds]) : Promise.resolve([] as Row[]),
    membersOf(ctx, conversationId),
  ]);
  const replies = new Map(replyRows.map((r) => [r.id, r]));
  const now = Date.now();
  return {
    conversation: { id: conversationId, kind: m.kind, title: m.title, muted: m.muted },
    members: people.map((p) => ({ ...publicUser(p), role: p.member_role, lastReadAt: iso(p.last_read_at), typing: Boolean(p.typing_until && new Date(p.typing_until).getTime() > now && p.id !== userId) })),
    messages: list.map((r) => messageView(ctx, r, userId, reactions, replies)),
    serverTime: iso(server_now),
  };
}

export async function send(ctx: Ctx, userId: string, conversationId: string, input: { kind?: unknown; text?: unknown; attachment?: unknown; replyTo?: unknown; recipeId?: unknown }) {
  const m = await membership(ctx, userId, conversationId);
  if (m.kind === 'direct') {
    const [other] = await ctx.sql.query(`SELECT user_id FROM members WHERE conversation_id = $1 AND user_id <> $2`, [conversationId, userId]);
    if (other && (await isBlocked(ctx.sql, userId, other.user_id))) fail(403, 'BLOCKED');
    // A hidden direct chat comes back for the other person when a new message arrives.
    if (other) await ctx.sql.query(`UPDATE members SET left_at = NULL WHERE conversation_id = $1 AND user_id = $2`, [conversationId, other.user_id]);
  }
  const kind = KINDS.includes(input.kind as typeof KINDS[number]) ? String(input.kind) : 'text';
  const text = clean(input.text, 4000);
  let attachment: string | null = null;
  if (kind === 'image') attachment = image(input.attachment, 900);
  if (kind === 'voice') attachment = audio(input.attachment, 1200);
  if (kind === 'recipe') {
    const [r] = await ctx.sql.query(`SELECT id, title, data FROM recipes WHERE id = $1 AND user_id = $2`, [String(input.recipeId || ''), userId]);
    if (!r) fail(404, 'NOT_FOUND');
    attachment = JSON.stringify({ id: r.id, title: r.title, data: r.data });
  }
  if (kind === 'text' && !text) fail(400, 'EMPTY_MESSAGE');
  const [{ n }] = await ctx.sql.query(`SELECT count(*)::int AS n FROM messages WHERE sender_id = $1 AND created_at > now() - interval '1 minute'`, [userId]);
  if (n >= 40) fail(429, 'RATE_LIMITED');
  let replyTo: string | null = null;
  if (typeof input.replyTo === 'string' && input.replyTo) {
    const [r] = await ctx.sql.query(`SELECT id FROM messages WHERE id = $1 AND conversation_id = $2`, [input.replyTo, conversationId]);
    replyTo = r?.id || null;
  }
  const id = newId('msg');
  await ctx.sql.query(
    `INSERT INTO messages (id, conversation_id, sender_id, kind, body_enc, attachment_enc, reply_to) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, conversationId, userId, kind, ctx.vault.seal(text), ctx.vault.seal(attachment), replyTo]);
  await ctx.sql.query(`UPDATE conversations SET last_at = clock_timestamp() WHERE id = $1`, [conversationId]);
  await ctx.sql.query(`UPDATE members SET last_read_at = clock_timestamp(), typing_until = NULL WHERE conversation_id = $1 AND user_id = $2`, [conversationId, userId]);
  const [row] = await ctx.sql.query(`SELECT * FROM messages WHERE id = $1`, [id]);
  return messageView(ctx, row, userId, [], new Map());
}

async function ownMessage(ctx: Ctx, userId: string, messageId: string) {
  const [row] = await ctx.sql.query(`SELECT * FROM messages WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL`, [messageId, userId]);
  if (!row) fail(404, 'NOT_FOUND');
  await membership(ctx, userId, row.conversation_id);
  return row;
}

export async function editMessage(ctx: Ctx, userId: string, messageId: string, text: unknown) {
  const row = await ownMessage(ctx, userId, messageId);
  if (row.kind !== 'text') fail(400, 'NOT_EDITABLE');
  if (Date.now() - new Date(row.created_at).getTime() > EDIT_WINDOW_MS) fail(400, 'EDIT_WINDOW_PASSED');
  const body = clean(text, 4000);
  if (!body) fail(400, 'EMPTY_MESSAGE');
  await ctx.sql.query(`UPDATE messages SET body_enc = $1, edited_at = clock_timestamp(), touched_at = clock_timestamp() WHERE id = $2`, [ctx.vault.seal(body), messageId]);
}

/** «حذف للجميع»: the content is erased from the database, a «message deleted» marker stays. */
export async function deleteMessage(ctx: Ctx, userId: string, messageId: string) {
  await ownMessage(ctx, userId, messageId);
  await ctx.sql.query(`UPDATE messages SET body_enc = NULL, attachment_enc = NULL, deleted_at = clock_timestamp(), touched_at = clock_timestamp() WHERE id = $1`, [messageId]);
  await ctx.sql.query(`DELETE FROM message_reactions WHERE message_id = $1`, [messageId]);
}


export async function reactMessage(ctx: Ctx, userId: string, messageId: string, emoji: unknown) {
  const [row] = await ctx.sql.query(`SELECT conversation_id FROM messages WHERE id = $1 AND deleted_at IS NULL`, [messageId]);
  if (!row) fail(404, 'NOT_FOUND');
  await membership(ctx, userId, row.conversation_id);
  if (!emoji) await ctx.sql.query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
  else {
    if (!MESSAGE_EMOJI.includes(String(emoji))) fail(400, 'INVALID_REACTION');
    await ctx.sql.query(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3) ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`, [messageId, userId, emoji]);
  }
  // Pollers fetch what changed since their last look: a reaction is a change.
  await ctx.sql.query(`UPDATE messages SET touched_at = clock_timestamp() WHERE id = $1`, [messageId]);
}

export async function markRead(ctx: Ctx, userId: string, conversationId: string) {
  await membership(ctx, userId, conversationId);
  await ctx.sql.query(`UPDATE members SET last_read_at = clock_timestamp() WHERE conversation_id = $1 AND user_id = $2`, [conversationId, userId]);
}

export async function typing(ctx: Ctx, userId: string, conversationId: string) {
  await membership(ctx, userId, conversationId);
  await ctx.sql.query(`UPDATE members SET typing_until = $1 WHERE conversation_id = $2 AND user_id = $3`, [new Date(Date.now() + TYPING_MS).toISOString(), conversationId, userId]);
}

/** One cheap call the browser repeats every few seconds: unread messages, unread notifications, requests. */
export async function pulse(ctx: Ctx, userId: string) {
  const [row] = await ctx.sql.query(
    `SELECT
       (SELECT count(*) FROM messages x JOIN members mb ON mb.conversation_id = x.conversation_id AND mb.user_id = $1 AND mb.left_at IS NULL AND NOT mb.muted
          WHERE x.created_at > mb.last_read_at AND x.sender_id <> $1 AND x.deleted_at IS NULL)::int AS messages,
       (SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL)::int AS notifications,
       (SELECT count(*) FROM friendships WHERE (user_a = $1 OR user_b = $1) AND status = 'pending' AND requester <> $1)::int AS requests,
       (SELECT max(c.last_at) FROM conversations c JOIN members mb ON mb.conversation_id = c.id AND mb.user_id = $1)::text AS last_at,
       clock_timestamp()::text AS now`, [userId]);
  return { messages: row.messages, notifications: row.notifications, requests: row.requests, lastAt: row.last_at ? iso(row.last_at) : null, serverTime: iso(row.now) };
}
