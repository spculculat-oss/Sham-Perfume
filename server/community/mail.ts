/**
 * «بريد شام» — the platform's own mail service: a Gmail-like mailbox for every member.
 *
 *  - Inside the platform: each member has «handle@sham» and can also be reached by the e-mail they
 *    registered with.  - Outside the platform: letters whose addressee is a real e-mail address (gmail.com, yahoo.com,
 *    hotmail.com, …) leave via the server's mail provider (RESEND_API_KEY / SENDGRID_API_KEY /
 *    SHAM_WEBHOOK_URL — the same keys the auth e-mails use) with the member's «handle@domain» as
 *    Reply-To. Without a provider the server says so honestly (status «unconfigured» + a bounce).
 *  - Receiving from outside works through POST /api/community/mail/inbound (shared token), fed by
 *    Resend Inbound, a Cloudflare Email Worker, or any JSON/form forwarder — see README «بريد خارجي».
 *  - One message row holds the encrypted subject, body and optional picture; every addressee plus the
 *    sender gets their own mailbox copy (star / read / archive / trash are per member, like Gmail).
 *  - Folders: الوارد (inbox), المميزة (starred), المرسلة (sent), المسودات (drafts), الأرشيف,
 *    المهملات (trash). Search never sees clear text: keyed HMAC blind indexes of the words — the
 *    same technique as the members' e-mail look-up (see service.ts / crypto.ts).
 *  - The platform itself writes too: a welcome mail on sign-up, a «mail delivery subsystem» bounce
 *    when an address cannot be resolved, and official audited mail the administration sends a member
 *    (sender NULL + kind system → rendered as «إدارة شام», verified).
 *  - Encryption at rest and blocking between members follow the messenger's rules (messenger.ts).
 */
import type { Row } from './db';
import { newId } from './crypto';
import { USER_COLUMNS, clean, fail, image, isBlocked, isEmail, publicUser, type Ctx } from './service';
import { mailDomain, sendMailOutbound } from './notify';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
export const MAIL_FOLDERS = ['inbox', 'sent', 'drafts', 'archive', 'trash'] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];
const LIST_FOLDERS = [...MAIL_FOLDERS, 'starred'] as const;
const PAGE = 40;
const MAX_RECIPIENTS = 20;
const MAX_TOKENS = 600;

/* ---------------------------------------------- parties ---------------------------------------------- */

export interface MailParty { id: string | null; handle: string; name: string; avatar: string | null; address: string; system?: boolean; external?: boolean }

/** The platform's two system senders: «إدارة شام» and the local mail delivery service. */
const SYSTEM_PARTIES: Record<string, { handle: string; address: string }> = {
  sham: { handle: 'sham', address: 'admin@sham' },
  'sham-mail': { handle: 'sham-mail', address: 'mailer@sham' },
};

/** A party that lives outside the platform (a real e-mail address). */
function externalParty(raw: unknown, fallbackAddress = ''): MailParty {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const address = clean(obj.address ?? fallbackAddress, 254);
  return { id: null, handle: '', name: clean(obj.name, 80) || address.split('@')[0] || '?', avatar: null, address, external: true };
}

function partyFrom(row: Row | undefined | null, systemFrom = 'admin'): MailParty {
  if (!row) {
    const sys = systemFrom === 'mailer' ? SYSTEM_PARTIES['sham-mail'] : SYSTEM_PARTIES.sham;
    return { ...sys, id: null, name: '', avatar: null, system: true };
  }
  const user = publicUser(row);
  return { id: user.id, handle: user.handle, name: user.name, avatar: user.avatar, address: `${user.handle}@sham` };
}

/* ------------------------------------------- search tokens ------------------------------------------- */

/** Lower-cased words of two letters or more (Arabic and Latin), for the blind search index. */
export function tokenize(text: string): Set<string> {
  const words = new Set<string>();
  for (const m of text.toLowerCase().matchAll(/[\p{L}\p{N}_]{2,24}/gu)) {
    words.add(m[0]);
    if (words.size >= MAX_TOKENS) break;
  }
  return words;
}

async function indexTokens(ctx: Ctx, messageId: string, userId: string, clear: boolean) {
  if (!userId) return;
  if (clear) await ctx.sql.query(`DELETE FROM mail_tokens WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
  const [own] = await ctx.sql.query(`SELECT subject_enc, body_enc FROM mail_messages WHERE id = $1`, [messageId]);
  if (!own) return;
  const tokens = [...tokenize(`${ctx.vault.open(own.subject_enc)} ${ctx.vault.open(own.body_enc)}`)].map((t) => ctx.vault.index(t));
  if (tokens.length) await ctx.sql.query(`INSERT INTO mail_tokens (message_id, user_id, token) SELECT $1, $2, unnest($3::text[]) ON CONFLICT DO NOTHING`, [messageId, userId, tokens]);
}

/* ------------------------------------------- recipients ------------------------------------------- */

async function userRowBy(ctx: Ctx, looks: { id?: string; handle?: string; email?: string }) {
  const select = `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN merchants m ON m.user_id = u.id WHERE u.status = 'active' AND `;
  if (looks.id) return (await ctx.sql.query(`${select} u.id = $1`, [looks.id]))[0];
  if (looks.handle) return (await ctx.sql.query(`${select} u.handle = $1`, [looks.handle]))[0];
  if (looks.email) return (await ctx.sql.query(`${select} u.email_idx = $1`, [ctx.vault.index(looks.email.toLowerCase())]))[0];
  return undefined;
}

/**
 * Understands anything a member may type in «إلى»: a handle (`sara`, `@sara`, `sara@sham`),
 * a member id (`u_…`), or the e-mail the member registered with. Unknown / unreachable → null.
 */
export async function resolveRecipient(ctx: Ctx, _senderId: string, raw: string): Promise<Row | null> {
  let q = clean(raw, 254);
  if (!q) return null;
  q = q.replace(/^@+/, '');
  if (/^u_[\w-]+$/.test(q)) return (await userRowBy(ctx, { id: q })) ?? null;
  if (/@(sham|sham\.mail)$/i.test(q)) return (await userRowBy(ctx, { handle: q.split('@')[0] })) ?? null;
  if (q.includes('@')) return (await userRowBy(ctx, { email: q })) ?? null;
  return (await userRowBy(ctx, { handle: q })) ?? null;
}

/**
 * Turns a list of typed addresses into member recipients, plus the outside world: an address that
 * looks like a real e-mail but belongs to no member becomes an «external» recipient (sent through
 * the server's mail provider). Blocked members and pure typos are reported as missed.
 */
async function resolveAll(ctx: Ctx, senderId: string, rawList: string[]) {
  const delivered: Row[] = [];
  const external: string[] = [];
  const missed: string[] = [];
  const seen = new Set<string>([senderId]);
  for (const raw of rawList.slice(0, MAX_RECIPIENTS)) {
    const row = await resolveRecipient(ctx, senderId, raw);
    if (row && row.id === senderId) continue; // writing to yourself stays only in «المرسلة» — no bounce
    if (row && !seen.has(row.id) && !(await isBlocked(ctx.sql, senderId, row.id))) {
      seen.add(row.id);
      delivered.push(row);
      continue;
    }
    if (!row && isEmail(raw.trim()) && !/@(sham|sham\.mail)$/i.test(raw.trim())) {
      if (!external.includes(raw.trim().toLowerCase())) external.push(raw.trim().toLowerCase());
      continue;
    }
    if (raw.trim()) missed.push(raw.trim());
  }
  return { delivered, external: external.slice(0, 10), missed };
}

/* ---------------------------------------------- views ---------------------------------------------- */

function summary(ctx: Ctx, row: Row, people: Map<string, Row>, recipients: Map<string, Row[]>) {
  const kind: 'personal' | 'system' | 'external' = row.sender_id ? 'personal' : row.kind === 'external' ? 'external' : 'system';
  const from = kind === 'external' ? externalParty(row.external_from) : partyFrom(people.get(row.sender_id), typeof row.system_from === 'string' ? row.system_from : 'admin');
  const to = [...(recipients.get(row.id) || []).map((u) => partyFrom(u)), ...(Array.isArray(row.external_to) ? row.external_to : []).map((a) => externalParty(a, String(a)))];
  const body = ctx.vault.open(row.body_enc);
  return {
    id: row.id, folder: row.folder, read: Boolean(row.read_at), starred: Boolean(row.starred),
    kind, from, to,
    subject: ctx.vault.open(row.subject_enc), snippet: body.replace(/\s+/g, ' ').slice(0, 160),
    hasAttachment: Boolean(row.attachment_enc),
    extStatus: typeof row.ext_status === 'string' ? row.ext_status : '',
    at: iso(row.sent_at || row.created_at), updatedAt: iso(row.updated_at),
  };
}

async function peopleMaps(ctx: Ctx, rows: Row[]) {
  const senderIds = rows.map((r) => r.sender_id).filter(Boolean) as string[];
  const messageIds = rows.map((r) => r.id);
  const senders = senderIds.length
    ? await ctx.sql.query(`SELECT ${USER_COLUMNS} FROM users u LEFT JOIN merchants m ON m.user_id = u.id WHERE u.id = ANY($1)`, [[...new Set(senderIds)]])
    : [];
  const recipRows = messageIds.length
    ? await ctx.sql.query(
        `SELECT r.message_id, ${USER_COLUMNS} FROM mail_recipients r JOIN users u ON u.id = r.user_id LEFT JOIN merchants m ON m.user_id = u.id WHERE r.message_id = ANY($1)`,
        [messageIds])
    : [];
  const people = new Map<string, Row>(senders.map((u) => [u.id as string, u]));
  for (const r of recipRows) people.set(r.id as string, r);
  const recipients = new Map<string, Row[]>();
  for (const r of recipRows) recipients.set(r.message_id as string, [...(recipients.get(r.message_id) || []), r]);
  return { people, recipients };
}

const isFolder = (v: string): v is (typeof LIST_FOLDERS)[number] => (LIST_FOLDERS as readonly string[]).includes(v);

/* ---------------------------------------------- queries ---------------------------------------------- */

/** The unread counters behind the sidebar and the «بريد شام» tab badge. */
export async function counts(ctx: Ctx, userId: string) {
  const [row] = await ctx.sql.query(
    `SELECT
       count(*) FILTER (WHERE folder = 'inbox')::int AS inbox,
       count(*) FILTER (WHERE folder = 'inbox' AND read_at IS NULL)::int AS unread,
       count(*) FILTER (WHERE folder = 'drafts')::int AS drafts,
       count(*) FILTER (WHERE folder = 'trash')::int AS trash,
       count(*) FILTER (WHERE starred)::int AS starred
     FROM mail_copies WHERE user_id = $1`, [userId]);
  return row as { inbox: number; unread: number; drafts: number; trash: number; starred: number };
}

/**
 * One folder of the mailbox (or search results over every folder but trash): newest first,
 * `before` pages older ones. Search = blind-index tokens must all hit, plus a sender-name match.
 */
export async function list(ctx: Ctx, userId: string, options: { folder?: unknown; before?: unknown; q?: unknown } = {}) {
  const folder = isFolder(String(options.folder || '')) ? String(options.folder) : 'inbox';
  const q = clean(options.q, 120);
  const conditions: string[] = ['c.user_id = $1'];
  const params: unknown[] = [userId];
  if (q) {
    const tokens = [...tokenize(q)].slice(0, 8);
    const word = q.toLowerCase();
    const clauses: string[] = [];
    if (tokens.length) {
      params.push(tokens.map((t) => ctx.vault.index(t)));
      params.push(tokens.length);
      clauses.push(`c.message_id IN (SELECT message_id FROM mail_tokens WHERE user_id = $1 AND token = ANY($${params.length - 1}) GROUP BY message_id HAVING count(DISTINCT token) >= $${params.length})`);
    }
    params.push(`%${word}%`);
    clauses.push(`c.message_id IN (SELECT m2.id FROM mail_messages m2 JOIN users us ON us.id = m2.sender_id WHERE (lower(us.name) LIKE $${params.length} OR lower(us.handle) LIKE $${params.length}))`);
    conditions.push(`(${clauses.join(' OR ')})`);
    if (folder === 'starred') conditions.push(`c.starred AND c.folder <> 'trash'`);
    else if (folder !== 'inbox') conditions.push(`c.folder = '${folder}'`);
    else conditions.push(`c.folder <> 'trash'`);
  } else if (folder === 'starred') conditions.push(`c.starred AND c.folder <> 'trash'`);
  else conditions.push(`c.folder = '${folder}'`);
  if (typeof options.before === 'string' && !Number.isNaN(Date.parse(options.before))) {
    params.push(options.before);
    conditions.push(`COALESCE(m.sent_at, c.created_at) < $${params.length}`);
  }
  const rows = await ctx.sql.query(
    `SELECT c.message_id AS id, c.folder, c.starred, c.read_at, c.updated_at, m.sender_id, m.system_from, m.kind, m.external_from, m.external_to, m.ext_status, m.subject_enc, m.body_enc, m.attachment_enc,
            m.created_at, m.sent_at
     FROM mail_copies c JOIN mail_messages m ON m.id = c.message_id
     WHERE ${conditions.join(' AND ')} ORDER BY COALESCE(m.sent_at, c.created_at) DESC LIMIT ${PAGE + 1}`, params);
  const page = rows.slice(0, PAGE);
  const { people, recipients } = await peopleMaps(ctx, page);
  return {
    items: page.map((r) => summary(ctx, r, people, recipients)),
    more: rows.length > PAGE,
    next: rows.length > PAGE ? String(rows[PAGE - 1].sent_at || rows[PAGE - 1].created_at) : null,
  };
}

/** The member's copy of a message; opens in the inbox mark it read (Gmail behaviour). */
export async function view(ctx: Ctx, userId: string, messageId: string) {
  const [row] = await ctx.sql.query(
    `SELECT c.message_id AS copy_id, c.folder, c.starred, c.read_at, c.updated_at, m.* FROM mail_copies c JOIN mail_messages m ON m.id = c.message_id WHERE c.message_id = $1 AND c.user_id = $2`,
    [messageId, userId]);
  if (!row) fail(404, 'NOT_FOUND');
  let read = Boolean(row.read_at);
  if (!read && row.folder === 'inbox' && row.sent_at && row.id) {
    await ctx.sql.query(`UPDATE mail_copies SET read_at = clock_timestamp(), updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
    read = true;
  }
  const { people, recipients } = await peopleMaps(ctx, [row]);
  const out = summary(ctx, row, people, recipients);
  let parent = null;
  if (row.parent_id) {
    const [p] = await ctx.sql.query(`SELECT m.sender_id, m.subject_enc FROM mail_messages m WHERE m.id = $1`, [row.parent_id]);
    if (p) {
      const [sender] = p.sender_id ? await ctx.sql.query(`SELECT ${USER_COLUMNS} FROM users u LEFT JOIN merchants m ON m.user_id = u.id WHERE u.id = $1`, [p.sender_id]) : [];
      parent = { id: row.parent_id, subject: ctx.vault.open(p.subject_enc), from: partyFrom(sender) };
    }
  }
  return {
    ...out, read,
    body: ctx.vault.open(row.body_enc),
    attachment: row.attachment_enc ? ctx.vault.open(row.attachment_enc) : null,
    parent,
    draftTo: row.folder === 'drafts' ? (Array.isArray(row.draft_to) ? row.draft_to.map(String) : []) : [],
  };
}

/* ---------------------------------------------- sending ---------------------------------------------- */

async function checkSendRate(ctx: Ctx, userId: string) {
  const [{ n }] = await ctx.sql.query(
    `SELECT count(*)::int AS n FROM mail_messages WHERE sender_id = $1 AND sent_at > now() - interval '1 minute'`, [userId]);
  if (n >= 40) fail(429, 'RATE_LIMITED');
  // Outside the platform the daily cap is low — the platform's mail reputation is on the line.
  const [{ n: out }] = await ctx.sql.query(
    `SELECT count(*)::int AS n FROM mail_messages WHERE sender_id = $1 AND external_to <> '[]'::jsonb AND sent_at > now() - interval '24 hours'`, [userId]);
  if (out >= 50) fail(429, 'RATE_LIMITED');
}

/** The environment for external providers (tests pass an empty one — nothing real can leak out). */
const envOf = (ctx: Ctx) => ctx.env ?? process.env;

/** Stores one message with its per-member copies (search tokens per copy). */
async function deliver(ctx: Ctx, senderId: string | null, to: Row[], input: {
  subject: string; body: string; attachment?: string | null; parentId?: string | null;
  kind?: 'personal' | 'system' | 'external'; systemFrom?: 'admin' | 'mailer';
  externalFrom?: unknown; externalTo?: string[]; extMsgId?: string | null; extStatus?: string;
}) {
  const kind = input.kind || (senderId ? 'personal' : 'system');
  const id = newId('mail');
  await ctx.sql.tx(async (t) => {
    await t.query(
      `INSERT INTO mail_messages (id, sender_id, kind, system_from, subject_enc, body_enc, attachment_enc, parent_id, sent_at, external_from, external_to, ext_msg_id, ext_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, clock_timestamp(), $9, $10, $11, $12)`,
      [id, senderId, kind, senderId ? 'admin' : input.systemFrom || 'admin', ctx.vault.seal(input.subject), ctx.vault.seal(input.body || ' '), ctx.vault.seal(input.attachment || null), input.parentId || null,
        kind === 'external' && input.externalFrom ? JSON.stringify(input.externalFrom) : null,
        JSON.stringify(input.externalTo || []), input.extMsgId || null, input.extStatus || '']);
    if (senderId) await t.query(`INSERT INTO mail_copies (message_id, user_id, folder, read_at) VALUES ($1, $2, 'sent', clock_timestamp())`, [id, senderId]);
    for (const user of to) {
      if (user.id === senderId) continue; // one copy per member (the sent one), so no self-inbox duplicates
      await t.query(`INSERT INTO mail_recipients (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, user.id]);
      await t.query(`INSERT INTO mail_copies (message_id, user_id, folder) VALUES ($1, $2, 'inbox')`, [id, user.id]);
    }
  });
  if (senderId) await indexTokens(ctx, id, senderId, false);
  for (const user of to) await indexTokens(ctx, id, user.id, false);
  return id;
}

/**
 * The outside part of a letter: real e-mail through the server's provider, threaded back to the
 * member (Reply-To «handle@domain», Message-ID so answers land as replies). The result is written on
 * the message («sent» / «failed» / «unconfigured») and failures bounce to the member honestly.
 */
async function deliverExternal(ctx: Ctx, senderId: string, sender: { name: string; handle: string }, messageId: string, external: string[], subject: string, body: string) {
  if (!external.length) return { to: [] as string[], status: 'none' };
  const env = envOf(ctx);
  // Without a domain we own, there is no address a reply could reach: say so instead of inventing one.
  const domain = mailDomain(env);
  const idDomain = domain || 'mail.sham.invalid';
  const noReply = domain ? '' : '\nالرد على هذه الرسالة لا يصل للعضو؛ تواصل معه من خلال منصة شام.\n(Replies to this e-mail do not reach the member; contact them on the Sham platform.)';
  const result = await sendMailOutbound({
    to: external,
    subject: subject || '(بدون عنوان)',
    text: `${body}\n\n———\nأُرسلت هذه الرسالة من «بريد شام» على منصة شام للعطور بواسطة ${clean(sender.name, 60)}.\n(Sent from Sham Mail on the Sham Perfumes platform.)${noReply}`,
    ...(domain ? { replyTo: `${sender.handle}@${domain}` } : {}),
    headers: { 'Message-ID': `<${messageId}@${idDomain}>` },
  }, env);
  const status = result.delivered ? 'sent' : ['none', undefined].includes(result.provider) ? 'unconfigured' : 'failed';
  await ctx.sql.query(`UPDATE mail_messages SET external_to = $2, ext_status = $3, ext_msg_id = $4 WHERE id = $1`, [messageId, JSON.stringify(external), status, `<${messageId}@${idDomain}>`]);
  if (!result.delivered) {
    await bounce(ctx, senderId, {
      subject, missed: external, parentId: messageId, external: true,
      reason: status === 'unconfigured'
        ? 'الإرسال لإيميلات خارج المنصة محتاج مزود بريد متظبط على السيرفر (RESEND_API_KEY أو SENDGRID_API_KEY أو SHAM_WEBHOOK_URL). الميل محفوظ عندك في «المرسلة».'
        : 'مزود البريد رفض الإرسال دلوقتي — جرّب تاني بعد شوية. الميل محفوظ عندك في «المرسلة».',
    });
  }
  return { to: external, status };
}

/** A member writes to other members — or to any real e-mail address outside the platform. */
export async function send(ctx: Ctx, userId: string, input: { to?: unknown; subject?: unknown; body?: unknown; attachment?: unknown; parentId?: unknown }) {
  const rawTo = (Array.isArray(input.to) ? input.to : typeof input.to === 'string' ? input.to.split(/[;,]+/) : []).map(String);
  const subject = clean(input.subject, 190);
  const body = clean(input.body, 8000);
  const attachment = image(input.attachment, 900);
  if (!body && !attachment) fail(400, 'EMPTY_MESSAGE');
  if (!rawTo.filter((s) => s.trim()).length) fail(400, 'NO_RECIPIENTS');
  const parentId = typeof input.parentId === 'string' && input.parentId ? input.parentId : null;
  if (parentId) {
    const [p] = await ctx.sql.query(`SELECT 1 FROM mail_copies WHERE message_id = $1 AND user_id = $2`, [parentId, userId]);
    if (!p) fail(404, 'NOT_FOUND');
  }
  await checkSendRate(ctx, userId);
  const { delivered, external, missed } = await resolveAll(ctx, userId, rawTo);
  if (!delivered.length && !external.length) fail(404, 'NOT_FOUND', missed[0] || userId);
  const id = await deliver(ctx, userId, delivered, { subject, body, attachment, parentId });
  if (missed.length) await bounce(ctx, userId, { subject, missed, parentId: id });
  const outbound = await deliverExternal(ctx, userId, await senderInfo(ctx, userId), id, external, subject, body);
  return { id, delivered: delivered.length, missed, external: outbound };
}

async function senderInfo(ctx: Ctx, userId: string) {
  const [row] = await ctx.sql.query(`SELECT name, handle FROM users WHERE id = $1`, [userId]);
  return { name: (row?.name as string) || 'عضو شام', handle: (row?.handle as string) || 'sham' };
}

/* ---------------------------------------------- drafts ---------------------------------------------- */

const splitAddresses = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,]+/) : []).map((s) => clean(s, 254)).filter(Boolean).slice(0, MAX_RECIPIENTS);

async function ownDraft(ctx: Ctx, userId: string, draftId: string) {
  const [row] = await ctx.sql.query(
    `SELECT m.* FROM mail_copies c JOIN mail_messages m ON m.id = c.message_id WHERE c.message_id = $1 AND c.user_id = $2 AND c.folder = 'drafts'`,
    [draftId, userId]);
  if (!row) fail(404, 'NOT_FOUND');
  return row;
}

/** Creates or updates a draft. The typed addresses are kept even when they do not resolve yet. */
export async function saveDraft(ctx: Ctx, userId: string, input: { to?: unknown; subject?: unknown; body?: unknown; attachment?: unknown }, draftId?: string) {
  let subject: string; let body: string; let attachment: string | null; let rawTo: string[];
  if (draftId) {
    // PATCH semantics: only the fields the client actually sent change; the rest of the draft survives.
    const current = await ownDraft(ctx, userId, draftId);
    subject = input.subject !== undefined ? clean(input.subject, 190) : ctx.vault.open(current.subject_enc);
    body = input.body !== undefined ? clean(input.body, 8000) : ctx.vault.open(current.body_enc).trim();
    attachment = input.attachment !== undefined ? image(input.attachment, 900) : (current.attachment_enc ? ctx.vault.open(current.attachment_enc) : null);
    rawTo = input.to !== undefined ? splitAddresses(input.to) : (Array.isArray(current.draft_to) ? current.draft_to.map(String).filter(Boolean) : []);
  } else {
    subject = clean(input.subject, 190);
    body = clean(input.body, 8000);
    attachment = image(input.attachment, 900);
    rawTo = splitAddresses(input.to);
  }
  if (!rawTo.length && !subject && !body && !attachment) fail(400, 'EMPTY_MESSAGE');
  const { delivered } = await resolveAll(ctx, userId, rawTo);
  if (draftId) {
    await ctx.sql.tx(async (t) => {
      await t.query(`UPDATE mail_messages SET subject_enc = $2, body_enc = $3, attachment_enc = $4, draft_to = $5 WHERE id = $1`,
        [draftId, ctx.vault.seal(subject), ctx.vault.seal(body || ' '), ctx.vault.seal(attachment), JSON.stringify(rawTo)]);
      await t.query(`DELETE FROM mail_recipients WHERE message_id = $1`, [draftId]);
      for (const user of delivered) await t.query(`INSERT INTO mail_recipients (message_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [draftId, user.id]);
      await t.query(`UPDATE mail_copies SET updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`, [draftId, userId]);
    });
    await indexTokens(ctx, draftId, userId, true);
    return { id: draftId };
  }
  const draftLimit = await ctx.sql.query(`SELECT count(*)::int AS n FROM mail_copies WHERE user_id = $1 AND folder = 'drafts'`, [userId]);
  if (draftLimit[0].n >= 100) fail(429, 'MAILBOX_FULL');
  const id = newId('mail');
  await ctx.sql.tx(async (t) => {
    await t.query(
      `INSERT INTO mail_messages (id, sender_id, kind, subject_enc, body_enc, attachment_enc, draft_to) VALUES ($1,$2,'personal',$3,$4,$5,$6)`,
      [id, userId, ctx.vault.seal(subject), ctx.vault.seal(body || ' '), ctx.vault.seal(attachment), JSON.stringify(rawTo)]);
    await t.query(`INSERT INTO mail_copies (message_id, user_id, folder) VALUES ($1, $2, 'drafts')`, [id, userId]);
    for (const user of delivered) await t.query(`INSERT INTO mail_recipients (message_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, user.id]);
  });
  await indexTokens(ctx, id, userId, true);
  return { id };
}

/** Sends an existing draft (optionally with last-minute edits). Any address that no longer resolves bounces. */
export async function sendDraft(ctx: Ctx, userId: string, draftId: string, input: Record<string, unknown> = {}) {
  await ownDraft(ctx, userId, draftId);
  if (Object.keys(input || {}).length) await saveDraft(ctx, userId, input, draftId);
  const [row] = await ctx.sql.query(
    `SELECT m.subject_enc, m.body_enc, m.attachment_enc, m.draft_to FROM mail_copies c JOIN mail_messages m ON m.id = c.message_id WHERE c.message_id = $1 AND c.user_id = $2`,
    [draftId, userId]);
  const subject = ctx.vault.open(row.subject_enc);
  const body = ctx.vault.open(row.body_enc);
  const rawTo: string[] = Array.isArray(row.draft_to) ? row.draft_to.map(String).filter(Boolean) : [];
  if (!rawTo.length) fail(400, 'NO_RECIPIENTS');
  await checkSendRate(ctx, userId);
  const { delivered, external, missed } = await resolveAll(ctx, userId, rawTo);
  if (!delivered.length && !external.length) fail(404, 'NOT_FOUND', missed[0] || userId);
  await ctx.sql.tx(async (t) => {
    await t.query(`UPDATE mail_messages SET sent_at = clock_timestamp(), draft_to = '[]' WHERE id = $1`, [draftId]);
    await t.query(`UPDATE mail_copies SET folder = 'sent', read_at = clock_timestamp(), updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`, [draftId, userId]);
    for (const user of delivered) {
      await t.query(`INSERT INTO mail_recipients (message_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [draftId, user.id]);
      await t.query(`INSERT INTO mail_copies (message_id, user_id, folder) VALUES ($1,$2,'inbox') ON CONFLICT (message_id, user_id) DO NOTHING`, [draftId, user.id]);
    }
  });
  for (const user of delivered) await indexTokens(ctx, draftId, user.id, false);
  if (missed.length) await bounce(ctx, userId, { subject, missed, parentId: draftId });
  const outbound = await deliverExternal(ctx, userId, await senderInfo(ctx, userId), draftId, external, subject, body);
  return { id: draftId, delivered: delivered.length, missed, external: outbound };
}

/* ------------------------------------------ copy actions ------------------------------------------ */

async function ownCopy(ctx: Ctx, userId: string, messageId: string) {
  const [row] = await ctx.sql.query(`SELECT folder FROM mail_copies WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
  if (!row) fail(404, 'NOT_FOUND');
  return row;
}

/** Read / unread, star, and folder moves (archive = out of the inbox, trash, restore). */
export async function update(ctx: Ctx, userId: string, messageId: string, input: { read?: unknown; starred?: unknown; folder?: unknown }) {
  const copy = await ownCopy(ctx, userId, messageId);
  if (typeof input.read === 'boolean' && copy.folder !== 'drafts') {
    await ctx.sql.query(`UPDATE mail_copies SET read_at = $3, updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId, input.read ? new Date().toISOString() : null]);
  }
  if (typeof input.starred === 'boolean') {
    await ctx.sql.query(`UPDATE mail_copies SET starred = $3, updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`, [messageId, userId, input.starred]);
  }
  const target = clean(input.folder, 20);
  if (target) {
    const legal: Record<string, MailFolder[]> = {
      inbox: ['archive', 'trash'], sent: ['trash'], drafts: ['trash'], archive: ['inbox', 'trash'], trash: ['inbox'],
    };
    if (!(legal[copy.folder] || []).includes(target as MailFolder)) fail(400, 'INVALID_STATE');
    await ctx.sql.query(`UPDATE mail_copies SET folder = $3, updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`, [messageId, userId, target]);
  }
  return { ok: true };
}

/** Delete: from any folder it lands in the trash; deleting from the trash is forever (only my copy). */
export async function remove(ctx: Ctx, userId: string, messageId: string) {
  const copy = await ownCopy(ctx, userId, messageId);
  if (copy.folder !== 'trash') {
    await ctx.sql.query(`UPDATE mail_copies SET folder = 'trash', starred = false, updated_at = clock_timestamp() WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
    return { trashed: true };
  }
  await ctx.sql.tx(async (t) => {
    await t.query(`DELETE FROM mail_copies WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
    await t.query(`DELETE FROM mail_tokens WHERE message_id = $1 AND user_id = $2`, [messageId, userId]);
  });
  return { deleted: true };
}

export async function emptyTrash(ctx: Ctx, userId: string) {
  const ids = await ctx.sql.query(`SELECT message_id FROM mail_copies WHERE user_id = $1 AND folder = 'trash'`, [userId]);
  for (const row of ids) {
    await ctx.sql.tx(async (t) => {
      await t.query(`DELETE FROM mail_copies WHERE message_id = $1 AND user_id = $2`, [row.message_id, userId]);
      await t.query(`DELETE FROM mail_tokens WHERE message_id = $1 AND user_id = $2`, [row.message_id, userId]);
    });
  }
  return { deleted: ids.length };
}

export async function markAllRead(ctx: Ctx, userId: string) {
  await ctx.sql.query(`UPDATE mail_copies SET read_at = clock_timestamp(), updated_at = clock_timestamp() WHERE user_id = $1 AND folder = 'inbox' AND read_at IS NULL`, [userId]);
  return { ok: true };
}

/* -------------------------------------------- system mail -------------------------------------------- */

/** A platform letter (no human sender): welcome, bounces, official administration mail. */
export async function systemMail(ctx: Ctx, userId: string, mail: { subject: string; body: string; address?: string }) {
  const [member] = await ctx.sql.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!member) return null;
  return deliver(ctx, null, [member], { subject: clean(mail.subject, 190), body: clean(mail.body, 8000), systemFrom: mail.address === 'mailer@sham' ? 'mailer' : 'admin' });
}

/** The welcome letter every new member finds in «بريد شام» after sign-up. */
export async function welcomeMail(ctx: Ctx, userId: string, name: string, lang = 'ar') {
  const arabic = !lang || lang.toLowerCase().startsWith('ar');
  return systemMail(ctx, userId, arabic
    ? {
        subject: `أهلاً بيك يا ${clean(name, 40)} في بريد شام 📬`,
        body:
`أهلاً بيك يا ${clean(name, 40)}،

دي أول رسالة في بريدك الخاص على منصة شام للعطور.

بريد شام ده ميل زي الجيميل بس خاص بمنصتنا: بتوصلك هنا رسايل الإدارة الرسمية (زي دي)، إشعارات الحساب المهمة، وتقدر تراسل بيه أي عضو في مجتمع شام بعنوانه «اسم_المستخدم@sham».

جرّب كده: دوس «رسالة جديدة» وابعت ميل لأي صديق في المجتمع — هيلاقيها فوراً في صندوق الوارد بتاعه.

كل رسايلك مشفرة على السيرفر ولا يقدر يقراها حد غيرك.

مع أجمل التحيات،
إدارة شام — منصة العطور`,
      }
    : {
        subject: `Welcome to Sham Mail, ${clean(name, 40)} 📬`,
        body:
`Hello ${clean(name, 40)},

this is the first letter in your private mailbox on the Sham Perfumes platform.

Sham Mail works like Gmail, but it lives entirely inside our platform: you will receive official letters from the administration (like this one), important account notices, and you can write to any member of the Sham community at their address «username@sham».

Try it: press "Compose" and write to yourself or a friend — the letter lands in their inbox instantly.

All your mail is encrypted on the server; nobody but you can read it.

Warm regards,
The Sham administration`,
      });
}

/** «Mail Delivery Subsystem»: a local bounce when some addresses could not be delivered. */
async function bounce(ctx: Ctx, userId: string, info: { subject: string; missed: string[]; parentId?: string; external?: boolean; reason?: string }) {
  const list = info.missed.slice(0, MAX_RECIPIENTS).map((m) => `• ${m}`).join('\n');
  await systemMail(ctx, userId, {
    address: 'mailer@sham',
    subject: `تعذّر التسليم: ${info.subject || '(بدون عنوان)'}`,
    body:
`رسالة من خدمة بريد شام (Delivery Status Notification).

${info.reason || `الميل بتاعك${info.subject ? ` «${info.subject}»` : ''} اتبعت للعناوين الصحيحة، لكن العناوين دي مش موجودة على المنصة أو مش متاحة، فما وصلتش:`}

${list}

${info.external ? '' : 'اتأكد من كتابة اسم المستخدم أو البريد بتاع العضو وحاول تاني. الرسالة الأصلية موجودة في «المرسلة».'}

— خدمة بريد شام (هذه رسالة تلقائية، لا تُرَد عليها).`,
  }).catch(() => {});
}

/** Official mail from the administration to one member (audited). */
export async function adminMail(ctx: Ctx, targetUserId: string, input: { subject?: unknown; body?: unknown }) {
  const subject = clean(input.subject, 190);
  const body = clean(input.body, 8000);
  if (!subject && !body) fail(400, 'EMPTY_MESSAGE');
  const id = await systemMail(ctx, targetUserId, { subject: subject || 'رسالة من إدارة شام', body });
  if (!id) fail(404, 'NOT_FOUND');
  await ctx.sql.query(`INSERT INTO audit (actor, action, target, detail) VALUES ('admin', 'mail_send', $1, $2)`, [targetUserId, subject.slice(0, 200)]).catch(() => {});
  return { id };
}

/* -------------------------------------------- inbound (outside → in) -------------------------------------------- */

export interface ParsedInbound {
  from: string;
  to: string[];
  subject: string;
  body: string;
  messageId: string;
  inReplyTo: string;
  references: string[];
}

const parseAddress = (raw: string): { name: string; address: string } => {
  const match = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw.trim()) || [null, '', raw.trim()] as const;
  const address = clean(String(match[2]), 254).toLowerCase();
  const name = clean(String(match[1]).replace(/^"|"$/g, ''), 80);
  return { name, address };
};

const splitAddressList = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return raw.split(/[;,]+/).map((part) => parseAddress(part).address).filter((a) => isEmail(a));
};

const headerValue = (headers: string, name: string): string => {
  const match = new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(headers);
  return match ? match[1].trim() : '';
};

/** Very small, honest HTML-to-text (no tracking, no scripts — everything but the words goes away). */
const htmlToText = (html: string): string =>
  clean(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'),
    8000);

/**
 * Understands the payload shapes inbound providers use: a generic JSON body, Resend Inbound
 * (`{ type: 'email.received', data: { … } }`) and form posts (Cloudflare Email Worker, forwarders).
 */
export function normalizeInbound(body: unknown): ParsedInbound {
  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const data = (source.data && typeof source.data === 'object' ? source.data : source) as Record<string, unknown>;
  const headersText = typeof data.headers === 'string' ? data.headers : '';
  const headersObj = (data.headers && typeof data.headers === 'object' ? data.headers : {}) as Record<string, unknown>;
  const messageId = clean(
    String(data.message_id || data.messageId || data['Message-ID'] || headersObj['message-id'] || headersObj['Message-ID'] || headerValue(headersText, 'Message-ID') || ''), 240);
  return {
    from: clean(String(data.from || data.sender || source.from || ''), 254),
    to: [...new Set([
      ...splitAddressList(data.to ?? source.to),
      ...splitAddressList(data.cc ?? source.cc),
    ])],
    subject: clean(String(data.subject || ''), 190),
    body: typeof data.text === 'string' && data.text.trim() ? clean(data.text, 8000)
      : typeof data.html === 'string' ? htmlToText(data.html)
      : clean(String(data.body || ''), 8000),
    messageId,
    inReplyTo: clean(String(data.in_reply_to || data.inReplyTo || headersObj['in-reply-to'] || headerValue(headersText, 'In-Reply-To') || ''), 240),
    references: String(String(data.references || headersObj.references || headerValue(headersText, 'References') || '')).match(/<[^>]+>/g)?.slice(0, 10) || [],
  };
}

/**
 * A letter arriving from outside the platform (Gmail, Yahoo, … via the provider's inbound hook):
 * routed to the members of every «handle@domain» or registered e-mail it was addressed to, tagged
 * «external» with the real sender, and threaded onto our message when In-Reply-To/References match.
 */
export async function inbound(ctx: Ctx, input: ParsedInbound) {
  const sender = parseAddress(input.from);
  if (!isEmail(sender.address)) fail(400, 'INVALID_REQUEST', 'from');
  // Route every recipient to its member: «handle@our-domain» or the e-mail they registered with.
  const domain = mailDomain(envOf(ctx));
  const members = new Map<string, Row>();
  for (const address of input.to.slice(0, 20)) {
    let row: Row | undefined;
    if (domain && address.endsWith(`@${domain}`)) row = await userRowBy(ctx, { handle: address.slice(0, -domain.length - 1) });
    if (!row) row = await userRowBy(ctx, { email: address });
    if (row) members.set(row.id as string, row);
  }
  if (!members.size) return { delivered: 0 };
  // Idempotency: providers retry webhooks — the same Message-ID never drops a second copy.
  if (input.messageId) {
    const [dup] = await ctx.sql.query(`SELECT id FROM mail_messages WHERE ext_msg_id = $1`, [input.messageId]);
    if (dup) return { delivered: 0, duplicate: true };
  }
  // Threading back onto the member's sent letter (the answers land where they belong).
  let parentId: string | null = null;
  const refs = [input.inReplyTo, ...input.references].filter(Boolean);
  for (const ref of refs) {
    const id = /<([^>]+)>/.exec(ref)?.[1] || ref;
    const [parent] = await ctx.sql.query(`SELECT id FROM mail_messages WHERE ext_msg_id = $1 OR id = $2`, [ref, id.split('@')[0]]);
    if (parent) { parentId = parent.id as string; break; }
  }
  // One sender may not flood a member: at most 60 inbound letters per sender address per hour.
  const [{ n: flood }] = await ctx.sql.query(
    `SELECT count(*)::int AS n FROM mail_messages WHERE kind = 'external' AND external_from->>'address' = $1 AND sent_at > now() - interval '1 hour'`,
    [sender.address]);
  if (flood >= 60) return { delivered: 0, flooded: true };
  const body = input.body || '(وصلت رسالة فارغة المحتوى — مزودك مرّر العنوان فقط بدون النص.)';
  const id = await deliver(ctx, null, [...members.values()], {
    subject: input.subject, body, parentId,
    kind: 'external', externalFrom: sender, extMsgId: input.messageId || null,
  });
  return { id, delivered: members.size };
}
