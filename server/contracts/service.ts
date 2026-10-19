/**
 * «مسؤول التعاقدات» — supplier agreements with electronic consent (criteria: server/contracts/policy.ts, decision
 * L-40). Stored in the same encrypted Postgres as «مجتمع شام» (server/community/db.ts): the stores' e-mails and
 * the signers' names are sealed with the server key; the signature record keeps the agreement's SHA-256, the
 * time, the device and how the store's official e-mail was verified (C-09).
 *
 * Life of an agreement: draft → sent → viewed → signed → approved (by the legal manager, C-10) — or declined /
 * opted_out / revoked (the store withdrew: removal within 48 h, C-07). Only «approved» lets the importer read
 * that store (scripts/shaheen-import/guard.ts).
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Sql, Row } from '../community/db';
import type { Vault } from '../community/crypto';
import { sendAuthEmail } from '../community/notify';
import { checkLetter, missingSender, normalizeDomain, EMPTY_SENDER, POLICY_VERSION, SIGN_PATH, type Sender, type Verification } from './policy';
import { AGREEMENT_VERSION, agreementText, outreachLetter, reminderLetter, welcomeLetter, type Lang, type Letter, type Party } from './documents';

type Env = Record<string, string | undefined>;
export interface ContractsCtx { sql: Sql; vault: Vault; env: Env; fetch?: typeof fetch }

export const CONTRACT_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS contract_meta (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS supplier_contracts (
    id text PRIMARY KEY,
    domain text NOT NULL,
    store_name text NOT NULL,
    lang text NOT NULL DEFAULT 'ar',
    contact_name_enc text,
    contact_email_enc text NOT NULL,
    token_hash text UNIQUE NOT NULL,
    token_enc text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    doc_version int NOT NULL,
    doc_text text NOT NULL,
    doc_hash text NOT NULL,
    sender_json text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz, reminded_at timestamptz, viewed_at timestamptz, signed_at timestamptz,
    declined_at timestamptz, approved_at timestamptz, revoked_at timestamptz, opted_out_at timestamptz,
    signer_name_enc text, signer_title_enc text, signer_ip_enc text, signer_agent text,
    verification text, evidence_hash text,
    code_salt text, code_hash text, code_expires timestamptz, code_attempts int NOT NULL DEFAULT 0, code_sent_at timestamptz, code_undelivered boolean NOT NULL DEFAULT false,
    note text NOT NULL DEFAULT ''
  )`,
  `ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS code_undelivered boolean NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS supplier_contracts_domain ON supplier_contracts (domain)`,
];
export async function migrateContracts(sql: Sql) { for (const statement of CONTRACT_SCHEMA) await sql.query(statement); }

export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'approved' | 'revoked' | 'opted_out';
const OPEN: ContractStatus[] = ['draft', 'sent', 'viewed'];
const LIVE: ContractStatus[] = ['draft', 'sent', 'viewed', 'signed', 'approved'];

export class ContractError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const now = () => new Date().toISOString();
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);
export const emailConfigured = (env: Env) => Boolean(env.RESEND_API_KEY?.trim() || env.SENDGRID_API_KEY?.trim() || env.SHAM_WEBHOOK_URL?.trim());
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const mask = (email: string) => email.replace(/^(.).*?(.?)@(.).*?(\.[^.]+)$/, (_m, a, b, c, d) => `${a}•••${b}@${c}•••${d}`);

/* ----------------------------------------------- settings ----------------------------------------------- */
export async function getSender(ctx: ContractsCtx): Promise<Sender> {
  const rows = await ctx.sql.query(`SELECT value FROM contract_meta WHERE key = 'sender'`);
  if (!rows[0]) return { ...EMPTY_SENDER };
  try { return { ...EMPTY_SENDER, ...JSON.parse(ctx.vault.open(rows[0].value) || '{}') }; } catch { return { ...EMPTY_SENDER }; }
}
export async function setSender(ctx: ContractsCtx, input: Partial<Sender>): Promise<Sender> {
  const s: Sender = {
    name: clean(input.name, 80), title: clean(input.title, 80), entityName: clean(input.entityName, 120), registrationNo: clean(input.registrationNo, 60),
    email: clean(input.email, 120).toLowerCase(), phone: clean(input.phone, 40), platformName: clean(input.platformName, 80), governingLaw: clean(input.governingLaw, 80) || EMPTY_SENDER.governingLaw,
  };
  if (s.email && !EMAIL.test(s.email)) throw new ContractError(400, 'INVALID_EMAIL', 'Invalid sender email');
  await ctx.sql.query(`INSERT INTO contract_meta (key, value) VALUES ('sender', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [ctx.vault.seal(JSON.stringify(s))]);
  return s;
}

/* ------------------------------------------------ views ------------------------------------------------- */
export interface ContractView {
  id: string; domain: string; storeName: string; lang: Lang; contactName: string; contactEmail: string; status: ContractStatus;
  docVersion: number; docHash: string; createdAt: string; sentAt?: string; remindedAt?: string; viewedAt?: string; signedAt?: string;
  declinedAt?: string; approvedAt?: string; revokedAt?: string; optedOutAt?: string;
  signerName?: string; signerTitle?: string; verification?: Verification; evidenceHash?: string; note: string; signUrl: string;
}
function view(ctx: ContractsCtx, r: Row, base: string): ContractView {
  return {
    id: r.id, domain: r.domain, storeName: r.store_name, lang: r.lang, contactName: ctx.vault.open(r.contact_name_enc), contactEmail: ctx.vault.open(r.contact_email_enc),
    status: r.status, docVersion: r.doc_version, docHash: r.doc_hash, createdAt: iso(r.created_at)!, sentAt: iso(r.sent_at), remindedAt: iso(r.reminded_at), viewedAt: iso(r.viewed_at),
    signedAt: iso(r.signed_at), declinedAt: iso(r.declined_at), approvedAt: iso(r.approved_at), revokedAt: iso(r.revoked_at), optedOutAt: iso(r.opted_out_at),
    signerName: ctx.vault.open(r.signer_name_enc) || undefined, signerTitle: ctx.vault.open(r.signer_title_enc) || undefined,
    verification: r.verification || undefined, evidenceHash: r.evidence_hash || undefined, note: r.note || '',
    signUrl: `${base.replace(/\/+$/, '')}${SIGN_PATH}${ctx.vault.open(r.token_enc)}`,
  };
}
const byId = async (ctx: ContractsCtx, id: string) => {
  const rows = await ctx.sql.query(`SELECT * FROM supplier_contracts WHERE id = $1`, [id]);
  if (!rows[0]) throw new ContractError(404, 'NOT_FOUND', 'Agreement not found');
  return rows[0];
};
const byToken = async (ctx: ContractsCtx, token: string) => {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) throw new ContractError(404, 'NOT_FOUND', 'This link is not valid');
  const rows = await ctx.sql.query(`SELECT * FROM supplier_contracts WHERE token_hash = $1`, [sha256(token)]);
  if (!rows[0]) throw new ContractError(404, 'NOT_FOUND', 'This link is not valid');
  return rows[0];
};

export async function listContracts(ctx: ContractsCtx, base: string): Promise<ContractView[]> {
  return (await ctx.sql.query(`SELECT * FROM supplier_contracts ORDER BY created_at DESC LIMIT 500`)).map((r) => view(ctx, r, base));
}
export async function getContract(ctx: ContractsCtx, id: string, base: string) { return view(ctx, await byId(ctx, id), base); }

export async function counts(ctx: ContractsCtx): Promise<Record<string, number>> {
  const rows = await ctx.sql.query<{ status: string; n: string | number }>(`SELECT status, count(*) AS n FROM supplier_contracts GROUP BY status`);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

/* ------------------------------------------------ create ------------------------------------------------ */
export interface NewContract { storeName: string; domain: string; contactEmail: string; contactName?: string; lang?: Lang }
export async function createContract(ctx: ContractsCtx, input: NewContract, base: string): Promise<{ contract: ContractView; letter: Letter; check: ReturnType<typeof checkLetter> }> {
  const sender = await getSender(ctx);
  const missing = missingSender(sender);
  if (missing.length) throw new ContractError(409, 'SENDER_INCOMPLETE', `Fill the sender settings first: ${missing.join(', ')}`);
  const storeName = clean(input.storeName, 120);
  const domain = normalizeDomain(input.domain);
  const email = clean(input.contactEmail, 160).toLowerCase();
  const lang: Lang = input.lang === 'en' ? 'en' : 'ar';
  if (storeName.length < 2) throw new ContractError(400, 'INVALID_STORE', 'Store name is required');
  if (!domain) throw new ContractError(400, 'INVALID_DOMAIN', 'A valid store domain is required (e.g. example.com)');
  if (!EMAIL.test(email)) throw new ContractError(400, 'INVALID_EMAIL', "A valid store email is required (the store's official address)");
  const active = await ctx.sql.query(`SELECT status FROM supplier_contracts WHERE domain = $1 AND status = ANY($2)`, [domain, [...LIVE, 'opted_out', 'declined']]);
  if (active.some((r) => r.status === 'opted_out' || r.status === 'declined')) throw new ContractError(409, 'OPTED_OUT', 'This store asked not to be contacted again (C-08)');
  if (active.length) throw new ContractError(409, 'ALREADY_EXISTS', 'This store already has an agreement in progress');
  const party: Party = { storeName, domain, contactName: clean(input.contactName, 80), lang };
  const text = agreementText(sender, party);
  const token = randomBytes(24).toString('base64url');
  const id = `ct_${randomBytes(8).toString('hex')}`;
  await ctx.sql.query(
    `INSERT INTO supplier_contracts (id, domain, store_name, lang, contact_name_enc, contact_email_enc, token_hash, token_enc, doc_version, doc_text, doc_hash, sender_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, domain, storeName, lang, ctx.vault.seal(party.contactName), ctx.vault.seal(email), sha256(token), ctx.vault.seal(token), AGREEMENT_VERSION, text, sha256(text), ctx.vault.seal(JSON.stringify(sender))],
  );
  const contract = await getContract(ctx, id, base);
  const letter = outreachLetter(sender, party, contract.signUrl);
  return { contract, letter, check: checkLetter(`${letter.subject}\n${letter.body}`, 'outreach', sender) };
}

/** The letters of an agreement, each checked against the legal manager's criteria. */
export async function lettersOf(ctx: ContractsCtx, id: string, base: string) {
  const r = await byId(ctx, id);
  const c = view(ctx, r, base);
  let sender: Sender;
  try { sender = { ...EMPTY_SENDER, ...JSON.parse(ctx.vault.open(r.sender_json) || '{}') }; } catch { sender = await getSender(ctx); }
  const party: Party = { storeName: c.storeName, domain: c.domain, contactName: c.contactName, lang: c.lang };
  const siteUrl = ctx.env.SHAM_SITE_URL?.trim() || 'https://spculculat-oss.github.io/Sham-Perfume/';
  const pack = (letter: Letter, stage: 'outreach' | 'reminder' | 'welcome') => ({ ...letter, check: checkLetter(`${letter.subject}\n${letter.body}`, stage, sender, { siteUrl }) });
  return {
    outreach: pack(outreachLetter(sender, party, c.signUrl), 'outreach'),
    reminder: pack(reminderLetter(sender, party, c.signUrl), 'reminder'),
    ...(c.status === 'approved' ? { welcome: pack(welcomeLetter(sender, party, siteUrl), 'welcome') } : {}),
  };
}

/* ---------------------------------------------- admin steps --------------------------------------------- */
async function setStatus(ctx: ContractsCtx, id: string, from: ContractStatus[], to: ContractStatus, column: string, note?: string) {
  const r = await byId(ctx, id);
  if (!from.includes(r.status)) throw new ContractError(409, 'WRONG_STATUS', `Not possible while the agreement is «${r.status}»`);
  await ctx.sql.query(`UPDATE supplier_contracts SET status = $2, ${column} = now()${note !== undefined ? ', note = $3' : ''} WHERE id = $1`, note !== undefined ? [id, to, clean(note, 500)] : [id, to]);
}
export const markSent = (ctx: ContractsCtx, id: string) => setStatus(ctx, id, ['draft', 'sent'], 'sent', 'sent_at');
export async function markReminded(ctx: ContractsCtx, id: string) {
  const r = await byId(ctx, id);
  if (!['sent', 'viewed'].includes(r.status)) throw new ContractError(409, 'WRONG_STATUS', 'A reminder is only for a sent agreement');
  if (r.reminded_at) throw new ContractError(409, 'ALREADY_REMINDED', 'One reminder only');
  await ctx.sql.query(`UPDATE supplier_contracts SET reminded_at = now() WHERE id = $1`, [id]);
}
/** The store answered «no» (C-08): never contacted again. */
export const markOptedOut = (ctx: ContractsCtx, id: string, note = '') => setStatus(ctx, id, OPEN, 'opted_out', 'opted_out_at', note);
/** No e-mail service: the store confirmed by replying from its official e-mail — recorded by the admin. */
export async function confirmEmailReply(ctx: ContractsCtx, id: string, note = '') {
  const r = await byId(ctx, id);
  if (r.status !== 'signed' || r.verification) throw new ContractError(409, 'WRONG_STATUS', 'Only for a signed agreement waiting for the e-mail confirmation');
  await ctx.sql.query(`UPDATE supplier_contracts SET verification = 'email_reply', evidence_hash = $2, note = $3 WHERE id = $1`,
    [id, sha256(`${r.evidence_hash}|email_reply|${now()}`), clean(note || 'confirmed by reply from the official e-mail', 500)]);
}
/** «اعتماد المدير القانوني» (C-10): only a signed and verified agreement. */
export async function approve(ctx: ContractsCtx, id: string, note = '') {
  const r = await byId(ctx, id);
  if (r.status !== 'signed') throw new ContractError(409, 'WRONG_STATUS', 'Only a signed agreement can be approved');
  if (!r.verification) throw new ContractError(409, 'NOT_VERIFIED', "The store's official e-mail is not verified yet (code or reply)");
  await ctx.sql.query(`UPDATE supplier_contracts SET status = 'approved', approved_at = now(), note = $2 WHERE id = $1`, [id, clean(note, 500)]);
}
/** The store withdrew its permission (C-07): the importer stops reading it at once; products removed within 48 h. */
export const revoke = (ctx: ContractsCtx, id: string, note = '') => setStatus(ctx, id, ['signed', 'approved'], 'revoked', 'revoked_at', note);

/** For the importer: the approved stores only (domains, dates, fingerprints — no personal data). */
export async function approvedStores(ctx: ContractsCtx) {
  const rows = await ctx.sql.query(`SELECT domain, approved_at, doc_hash, doc_version FROM supplier_contracts WHERE status = 'approved' ORDER BY domain`);
  return rows.map((r) => ({ domain: r.domain as string, approvedAt: iso(r.approved_at)!, docHash: r.doc_hash as string, docVersion: Number(r.doc_version) }));
}

/** The signature record (admin): everything needed as evidence. */
export async function certificate(ctx: ContractsCtx, id: string, base: string) {
  const r = await byId(ctx, id);
  const c = view(ctx, r, base);
  return {
    reference: c.id, store: { name: c.storeName, domain: c.domain, email: c.contactEmail }, status: c.status, policyVersion: POLICY_VERSION,
    agreement: { version: c.docVersion, sha256: c.docHash, text: r.doc_text as string },
    signature: c.signedAt ? { signer: c.signerName, title: c.signerTitle, signedAt: c.signedAt, verification: c.verification || 'pending', ip: ctx.vault.open(r.signer_ip_enc), device: r.signer_agent, evidenceSha256: c.evidenceHash } : undefined,
    timeline: { createdAt: c.createdAt, sentAt: c.sentAt, viewedAt: c.viewedAt, signedAt: c.signedAt, approvedAt: c.approvedAt, revokedAt: c.revokedAt, declinedAt: c.declinedAt },
  };
}

/* ---------------------------------------------- the store side ------------------------------------------ */
/** What the store sees on the signing page — the agreement only, no link to the store (C-05). */
export async function publicView(ctx: ContractsCtx, token: string) {
  const r = await byToken(ctx, token);
  if (['draft', 'sent'].includes(r.status)) await ctx.sql.query(`UPDATE supplier_contracts SET status = 'viewed', viewed_at = coalesce(viewed_at, now()) WHERE id = $1`, [r.id]);
  else if (!r.viewed_at) await ctx.sql.query(`UPDATE supplier_contracts SET viewed_at = now() WHERE id = $1`, [r.id]);
  const status: ContractStatus = ['draft', 'sent'].includes(r.status) ? 'viewed' : r.status;
  return {
    storeName: r.store_name as string, domain: r.domain as string, lang: r.lang as Lang, text: r.doc_text as string, sha256: r.doc_hash as string, version: Number(r.doc_version),
    status, signable: OPEN.includes(status), codeRequired: emailConfigured(ctx.env) && !r.code_undelivered, email: mask(ctx.vault.open(r.contact_email_enc)),
    signedAt: iso(r.signed_at), verification: r.verification || undefined,
  };
}

/** A 6-digit code to the store's official e-mail (sole control of the signature — C-01/C-09). */
export async function sendCode(ctx: ContractsCtx, token: string): Promise<{ delivered: boolean }> {
  const r = await byToken(ctx, token);
  if (!OPEN.includes(r.status)) throw new ContractError(409, 'WRONG_STATUS', 'This agreement can no longer be signed');
  if (!emailConfigured(ctx.env)) return { delivered: false };
  if (r.code_sent_at && Date.now() - Date.parse(r.code_sent_at) < 60_000) throw new ContractError(429, 'TOO_SOON', 'Please wait a minute before asking for a new code');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = randomBytes(12).toString('hex');
  await ctx.sql.query(`UPDATE supplier_contracts SET code_salt = $2, code_hash = $3, code_expires = now() + interval '15 minutes', code_attempts = 0, code_sent_at = now() WHERE id = $1`, [r.id, salt, sha256(`${salt}|${code}`)]);
  const en = r.lang === 'en';
  const subject = en ? `Your confirmation code: ${code}` : `كود التأكيد: ${code}`;
  const text = en
    ? `Your code to sign the agreement for ${r.store_name} is ${code}. It is valid for 15 minutes. If you did not ask for it, ignore this email.`
    : `كود توقيع اتفاقية ${r.store_name} هو ${code}، وصالح لمدة 15 دقيقة. إذا لم تطلبه تجاهل هذه الرسالة.`;
  const sent = await sendAuthEmail(ctx.vault.open(r.contact_email_enc), { subject, text, html: `<p dir="${en ? 'ltr' : 'rtl'}">${text.replace(code, `<b style="font-size:20px">${code}</b>`)}</p>` }, ctx.env, ctx.fetch);
  // When the e-mail could not go out the store can still sign; the signature then waits for the reply confirmation.
  await ctx.sql.query(`UPDATE supplier_contracts SET code_undelivered = $2 WHERE id = $1`, [r.id, !sent.delivered]);
  return { delivered: sent.delivered };
}

export interface SignInput { name: string; title: string; agree: boolean; sha256: string; code?: string; ip?: string; agent?: string }
export async function sign(ctx: ContractsCtx, token: string, input: SignInput) {
  const r = await byToken(ctx, token);
  if (!OPEN.includes(r.status)) throw new ContractError(409, 'WRONG_STATUS', 'This agreement can no longer be signed');
  if (input.agree !== true) throw new ContractError(400, 'CONSENT_REQUIRED', 'Please tick the consent box');
  if (input.sha256 !== r.doc_hash) throw new ContractError(409, 'TEXT_CHANGED', 'The agreement text changed — reload the page');
  const name = clean(input.name, 80); const title = clean(input.title, 80);
  if (name.length < 3) throw new ContractError(400, 'NAME_REQUIRED', 'Full name is required');
  if (title.length < 2) throw new ContractError(400, 'TITLE_REQUIRED', 'Your role in the store is required');
  let verification: Verification | null = null;
  if (emailConfigured(ctx.env) && !(r.code_undelivered && !String(input.code || '').trim())) {
    const code = String(input.code || '').replace(/\D/g, '');
    if (!r.code_hash || !r.code_expires || Date.parse(r.code_expires) < Date.now()) throw new ContractError(400, 'CODE_EXPIRED', 'Ask for a new code');
    if (r.code_attempts >= 5) throw new ContractError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts — ask for a new code');
    const ok = code.length === 6 && timingSafeEqual(Buffer.from(sha256(`${r.code_salt}|${code}`)), Buffer.from(r.code_hash));
    if (!ok) { await ctx.sql.query(`UPDATE supplier_contracts SET code_attempts = code_attempts + 1 WHERE id = $1`, [r.id]); throw new ContractError(400, 'WRONG_CODE', 'Wrong code'); }
    verification = 'email_code';
  }
  const at = now();
  const evidence = sha256([r.id, r.doc_hash, name, title, at, verification || 'pending', input.ip || '', input.agent || ''].join('|'));
  const done = await ctx.sql.query(
    `UPDATE supplier_contracts SET status = 'signed', signed_at = $2, signer_name_enc = $3, signer_title_enc = $4, signer_ip_enc = $5, signer_agent = $6,
       verification = $7, evidence_hash = $8, code_hash = NULL, code_salt = NULL WHERE id = $1 AND status = ANY($9) RETURNING id`,
    [r.id, at, ctx.vault.seal(name), ctx.vault.seal(title), ctx.vault.seal(input.ip || ''), clean(input.agent, 200), verification, evidence, OPEN],
  );
  if (!done.length) throw new ContractError(409, 'WRONG_STATUS', 'This agreement can no longer be signed');
  return { reference: r.id as string, signedAt: at, sha256: r.doc_hash as string, evidence, verification: verification || 'pending' };
}

export async function decline(ctx: ContractsCtx, token: string, reason = '') {
  const r = await byToken(ctx, token);
  if (!OPEN.includes(r.status)) throw new ContractError(409, 'WRONG_STATUS', 'This agreement is already closed');
  await ctx.sql.query(`UPDATE supplier_contracts SET status = 'declined', declined_at = now(), note = $2 WHERE id = $1`, [r.id, clean(reason, 500)]);
}
