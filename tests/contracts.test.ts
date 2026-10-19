import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import { Vault } from '../server/community/crypto';
import { connectPglite, type Sql } from '../server/community/db';
import type { Community } from '../server/community/router';
import * as c from '../server/contracts/service';
import { createContractsRouter } from '../server/contracts/router';
import { draftReply, templateReply, topicsOf } from '../server/contracts/assistant';
import { CONTRACT_CRITERIA, EMPTY_SENDER, SIGN_PATH, checkLetter, missingSender, normalizeDomain, type Sender } from '../server/contracts/policy';
import { agreementText, outreachLetter, reminderLetter, welcomeLetter, type Party } from '../server/contracts/documents';
import { allowedSources, fetchApprovedDomains, storeDomain } from '../scripts/shaheen-import/guard';
import { BOTS, LEGAL_DECISIONS, LINKS } from '../src/utils/shaheenOrg';

const KEY = 'test-contract-key-0123456789-abcdefghijk';
const BASE = 'https://engine.example';
const SITE = 'https://spculculat-oss.github.io/Sham-Perfume/';
const SENDER: Sender = { ...EMPTY_SENDER, name: 'Omar Hassan', title: 'Partnerships lead', entityName: 'Atyab Trading', email: 'omar@atyab.example', platformName: 'Atyab Marketplace' };
const REGISTERED: Sender = { ...SENDER, registrationNo: 'CR-12345', phone: '+20 100 000 0000' };
const PARTY_AR: Party = { storeName: 'متجر الورد', domain: 'rose.example', contactName: 'سارة', lang: 'ar' };
const PARTY_EN: Party = { storeName: 'Rose Store', domain: 'rose.example', contactName: 'Sara', lang: 'en' };
const SIGN = `${BASE}${SIGN_PATH}${'a'.repeat(32)}`;

let sql: Sql;
let ctx: c.ContractsCtx;
let seq = 0;
const store = () => ({ storeName: `Store ${++seq}`, domain: `store${seq}.example`, contactEmail: `owner${seq}@store${seq}.example`, contactName: 'Owner' });
const tokenOf = (signUrl: string) => signUrl.split(SIGN_PATH)[1]!;

before(async () => {
  sql = await connectPglite();
  await c.migrateContracts(sql);
  await c.migrateContracts(sql); // idempotent
  ctx = { sql, vault: new Vault(KEY), env: {} }; // no e-mail provider: verification by the store's reply
});
after(async () => { await sql?.close(); });

/* ------------------------------------------- the legal manager's checks ------------------------------------------- */

test('every letter passes the legal manager\'s criteria, in both languages, with or without a registration', () => {
  assert.equal(CONTRACT_CRITERIA.length, 10);
  for (const s of [SENDER, REGISTERED]) {
    for (const p of [PARTY_AR, PARTY_EN]) {
      const letters: [string, { subject: string; body: string }, 'outreach' | 'reminder' | 'welcome'][] = [
        ['outreach', outreachLetter(s, p, SIGN), 'outreach'], ['reminder', reminderLetter(s, p, SIGN), 'reminder'], ['welcome', welcomeLetter(s, p, SITE), 'welcome'],
      ];
      for (const [name, letter, stage] of letters) {
        const check = checkLetter(`${letter.subject}\n${letter.body}`, stage, s, { siteUrl: SITE });
        assert.equal(check.ok, true, `${name}/${p.lang}/${s.registrationNo ? 'reg' : 'noreg'}: ${JSON.stringify(check.problems)}`);
      }
      assert.ok(outreachLetter(s, p, SIGN).body.includes(SIGN), 'the outreach letter carries the signing link');
      assert.ok(!outreachLetter(s, p, SIGN).body.includes('github.io'), 'no store link before approval (C-05)');
      assert.ok(welcomeLetter(s, p, SITE).body.includes(SITE), 'the welcome letter carries the store link');
    }
  }
});

test('the checks reject a margin figure, outside links, AI company names, «company» without registration, missing opt-out, denying AI use', () => {
  const ok = outreachLetter(SENDER, PARTY_EN, SIGN);
  const base = `${ok.subject}\n${ok.body}`;
  const ids = (text: string, stage: 'outreach' | 'reply' = 'outreach', s = SENDER) => checkLetter(text, stage, s, { siteUrl: SITE }).problems.map((p) => p.id);
  assert.ok(ids(`${base}\nOur margin is 50%.`).includes('C-04'));
  assert.ok(ids(`${base}\nSee https://spculculat-oss.github.io/Sham-Perfume/`).includes('C-05'));
  assert.ok(ids(`${base}\nhttps://example.com/x`).includes('C-05'));
  assert.ok(ids(`${base}\nWritten with ChatGPT.`).includes('C-01'));
  assert.ok(ids(`${base}\nOur company is growing.`).includes('C-02'));
  assert.ok(!ids(`${base}\nOur company is growing.`, 'outreach', REGISTERED).includes('C-02'), '«company» is fine with a registration number');
  assert.ok(ids(base.replace(/[^\n]*(not interested|reply)[^\n]*\n?/gi, ''), 'outreach').includes('C-08'));
  assert.ok(ids(`${base}\nI am a real person, not a bot.`).includes('C-01'));
  assert.ok(ids(`${base}\nWe are your authorized dealer.`).includes('C-03'));
  assert.ok(ids(base.replaceAll(SENDER.name, 'Someone')).includes('C-01'), 'the real sender\'s name must be there');
  assert.ok(checkLetter(base, 'outreach', { ...SENDER, name: '' }).problems.some((p) => p.id === 'C-02'), 'incomplete sender settings are flagged');
  assert.deepEqual(missingSender(EMPTY_SENDER).length > 0, true);
  assert.equal(normalizeDomain('https://www.Rose.example/shop?x=1'), 'rose.example');
  assert.equal(normalizeDomain('not a domain'), '');
});

test('the agreement states the model honestly: intermediary, non-exclusive, revocable, margin private, both languages', () => {
  const text = agreementText(SENDER, PARTY_EN);
  assert.match(text, /non-exclusive/i);
  assert.match(text, /48/);
  assert.match(text, /withdraw/i);
  assert.match(text, /[\u0600-\u06FF]/, 'Arabic text is included');
  assert.doesNotMatch(text, /\d+\s?%/, 'no margin figure');
  assert.ok(text.includes(SENDER.entityName) && text.includes(PARTY_EN.storeName));
});

/* ------------------------------------------------ the reply drafter ------------------------------------------------ */

test('the approved replies pass the checks for every kind of question and never reveal the margin', () => {
  const questions = [
    'How much margin do you add on our prices?', 'كام نسبة الربح اللي هتحطوها؟', 'Are you a bot or a real person?', 'انت روبوت؟',
    'Can I see your website link?', 'ابعتلي لينك موقعكم', 'Who are you? Is this a registered company?', 'How do you pay and ship?',
    'Can we cancel anytime?', 'Is it exclusive?', 'Will you edit our photos?', 'Hello',
  ];
  for (const s of [SENDER, REGISTERED]) {
    for (const q of questions) {
      const text = templateReply(q, s, 'Sara');
      const check = checkLetter(text, 'reply', s);
      assert.equal(check.ok, true, `${q}: ${JSON.stringify(check.problems)}`);
      assert.doesNotMatch(text, /\d+\s?%|x\s?1\.\d/i);
    }
  }
  assert.match(templateReply('Are you a bot?', SENDER), /AI tools/, 'honest about AI use (C-01)');
  assert.match(templateReply('هل أنت روبوت؟', SENDER), /ذكاء اصطناعي/);
  assert.match(templateReply('What is your margin?', SENDER), /full price/);
  assert.deepEqual(topicsOf('Is it exclusive?'), ['exclusive']);
});

test('the AI draft is used only when it passes the checks — otherwise the approved template', async () => {
  const noEngine = await draftReply({ message: 'What margin do you add?', sender: SENDER }, { env: {} });
  assert.equal(noEngine.source, 'template');
  assert.equal(noEngine.check.ok, true);
  const gemini = (text: string): typeof fetch => (async (url: string | URL | Request) => {
    if (String(url).includes('generativelanguage')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  const env = { GEMINI_API_KEY: 'test-key' };
  const bad = await draftReply({ message: 'What margin do you add?', sender: SENDER }, { env, fetch: gemini(`Hi, we add 30% on top. ${SENDER.name} ${SENDER.email}`) });
  assert.equal(bad.source, 'template', 'a draft that reveals the margin is replaced');
  const good = `Hello Sara,\n\nOur platform sets the consumer price and you always receive your full price.\n\nKind regards,\n${SENDER.name}\n${SENDER.email}`;
  const fine = await draftReply({ message: 'What margin do you add?', sender: SENDER }, { env, fetch: gemini(good) });
  assert.equal(fine.source, 'ai');
  assert.equal(fine.engine, 'gemini');
});

/* --------------------------------------------------- the lifecycle -------------------------------------------------- */

test('no agreement before the sender\'s real details are filled in', async () => {
  await assert.rejects(c.createContract(ctx, store(), BASE), (e: c.ContractError) => e.code === 'SENDER_INCOMPLETE');
  await assert.rejects(c.setSender(ctx, { ...SENDER, email: 'bad' }), (e: c.ContractError) => e.code === 'INVALID_EMAIL');
  const saved = await c.setSender(ctx, SENDER);
  assert.equal(saved.name, SENDER.name);
  assert.deepEqual(await c.getSender(ctx), saved);
  const raw = JSON.stringify(await sql.query(`SELECT value FROM contract_meta`));
  assert.ok(!raw.includes(SENDER.email), 'the settings are encrypted');
});

test('full life: letter → view → sign → confirm by reply → legal approval → approved list → revoke', async () => {
  const input = store();
  const { contract, letter, check } = await c.createContract(ctx, input, BASE);
  assert.equal(contract.status, 'draft');
  assert.equal(check.ok, true, JSON.stringify(check.problems));
  assert.ok(letter.body.includes(contract.signUrl));
  assert.ok(contract.signUrl.startsWith(`${BASE}${SIGN_PATH}`));
  const stored = JSON.stringify(await sql.query(`SELECT * FROM supplier_contracts WHERE id = $1`, [contract.id]));
  assert.ok(!stored.includes(input.contactEmail) && !stored.includes(tokenOf(contract.signUrl)), 'e-mail and token are not stored in clear');
  await assert.rejects(c.createContract(ctx, { ...input, domain: `https://www.${input.domain}/` }, BASE), (e: c.ContractError) => e.code === 'ALREADY_EXISTS');

  await c.markSent(ctx, contract.id);
  await c.markReminded(ctx, contract.id);
  await assert.rejects(c.markReminded(ctx, contract.id), (e: c.ContractError) => e.code === 'ALREADY_REMINDED', 'one reminder only');

  const token = tokenOf(contract.signUrl);
  const page = await c.publicView(ctx, token);
  assert.equal(page.status, 'viewed');
  assert.equal(page.signable, true);
  assert.equal(page.codeRequired, false);
  assert.match(page.email, /•••/);
  assert.ok(!JSON.stringify(page).includes('github.io'), 'no store link on the signing page (C-05)');
  await assert.rejects(c.publicView(ctx, 'x'.repeat(40)), (e: c.ContractError) => e.status === 404);

  const signer = { name: 'Sara Ali', title: 'Owner', agree: true, sha256: page.sha256, ip: '203.0.113.9', agent: 'test' };
  await assert.rejects(c.sign(ctx, token, { ...signer, agree: false }), (e: c.ContractError) => e.code === 'CONSENT_REQUIRED');
  await assert.rejects(c.sign(ctx, token, { ...signer, sha256: 'f'.repeat(64) }), (e: c.ContractError) => e.code === 'TEXT_CHANGED');
  await assert.rejects(c.sign(ctx, token, { ...signer, name: 'S' }), (e: c.ContractError) => e.code === 'NAME_REQUIRED');
  const signed = await c.sign(ctx, token, signer);
  assert.equal(signed.verification, 'pending');
  assert.match(signed.evidence, /^[a-f0-9]{64}$/);
  await assert.rejects(c.sign(ctx, token, signer), (e: c.ContractError) => e.code === 'WRONG_STATUS', 'signed once');

  await assert.rejects(c.approve(ctx, contract.id), (e: c.ContractError) => e.code === 'NOT_VERIFIED', 'approval needs the official e-mail verified');
  assert.deepEqual(await c.approvedStores(ctx), []);
  await c.confirmEmailReply(ctx, contract.id, 'replied agreed on 2026-10-19');
  await c.approve(ctx, contract.id, 'ok');
  const approved = await c.approvedStores(ctx);
  assert.deepEqual(approved.map((s) => s.domain), [input.domain]);
  assert.deepEqual(Object.keys(approved[0]!).sort(), ['approvedAt', 'docHash', 'docVersion', 'domain'], 'no personal data in the importer\'s list');

  const letters = await c.lettersOf(ctx, contract.id, BASE);
  assert.ok(letters.welcome, 'the welcome letter (with the store link) only after approval');
  assert.equal(letters.welcome!.check.ok, true, JSON.stringify(letters.welcome!.check.problems));
  const cert = await c.certificate(ctx, contract.id, BASE);
  assert.equal(cert.signature?.signer, 'Sara Ali');
  assert.equal(cert.signature?.verification, 'email_reply');
  assert.equal(cert.signature?.ip, '203.0.113.9');
  assert.equal(cert.agreement.sha256, page.sha256);
  assert.ok(cert.agreement.text.length > 500);

  await c.revoke(ctx, contract.id, 'store asked');
  assert.deepEqual(await c.approvedStores(ctx), [], 'withdrawn at once (C-07)');
  assert.equal((await c.counts(ctx)).revoked, 1);
});

test('a store that declined or opted out is never contacted again (C-08)', async () => {
  const a = store();
  const one = await c.createContract(ctx, a, BASE);
  await c.markOptedOut(ctx, one.contract.id, 'said no');
  await assert.rejects(c.createContract(ctx, a, BASE), (e: c.ContractError) => e.code === 'OPTED_OUT');
  const b = store();
  const two = await c.createContract(ctx, b, BASE);
  await c.decline(ctx, tokenOf(two.contract.signUrl), 'not now');
  assert.equal((await c.publicView(ctx, tokenOf(two.contract.signUrl))).signable, false);
  await assert.rejects(c.createContract(ctx, b, BASE), (e: c.ContractError) => e.code === 'OPTED_OUT');
});

test('with an e-mail service the store signs with a 6-digit code to its official e-mail', async () => {
  const sent: string[] = [];
  let up = true;
  const hook = (async (_url: string | URL | Request, init?: RequestInit) => { sent.push(String(init?.body || '')); return new Response('{}', { status: up ? 200 : 500 }); }) as typeof fetch;
  const mail: c.ContractsCtx = { ...ctx, env: { SHAM_WEBHOOK_URL: 'https://hook.example/mail' }, fetch: hook };
  const { contract } = await c.createContract(mail, store(), BASE);
  const token = tokenOf(contract.signUrl);
  const page = await c.publicView(mail, token);
  assert.equal(page.codeRequired, true);
  const signer = { name: 'Lina Store', title: 'Manager', agree: true, sha256: page.sha256 };
  await assert.rejects(c.sign(mail, token, { ...signer, code: '123456' }), (e: c.ContractError) => e.code === 'CODE_EXPIRED', 'no code asked yet');
  assert.deepEqual(await c.sendCode(mail, token), { delivered: true });
  await assert.rejects(c.sendCode(mail, token), (e: c.ContractError) => e.code === 'TOO_SOON');
  const code = /\b(\d{6})\b/.exec(JSON.parse(sent.at(-1)!).text)![1]!;
  const wrong = code === '000000' ? '111111' : '000000';
  await assert.rejects(c.sign(mail, token, { ...signer, code: wrong }), (e: c.ContractError) => e.code === 'WRONG_CODE');
  const done = await c.sign(mail, token, { ...signer, code });
  assert.equal(done.verification, 'email_code');
  await c.approve(mail, contract.id);
  assert.ok((await c.approvedStores(mail)).some((s) => s.domain === contract.domain));

  // The e-mail could not go out: the store can still sign, and the signature waits for the reply confirmation.
  up = false;
  const other = await c.createContract(mail, store(), BASE);
  const t2 = tokenOf(other.contract.signUrl);
  assert.deepEqual(await c.sendCode(mail, t2), { delivered: false });
  const p2 = await c.publicView(mail, t2);
  assert.equal(p2.codeRequired, false);
  assert.equal((await c.sign(mail, t2, { ...signer, sha256: p2.sha256 })).verification, 'pending');
  await assert.rejects(c.approve(mail, other.contract.id), (e: c.ContractError) => e.code === 'NOT_VERIFIED');
});

/* ------------------------------------------------------ HTTP ------------------------------------------------------ */

test('routes: admin-gated team side, private signing page, approved list for the importer', async () => {
  const community = { ready: async () => ({ sql, vault: new Vault(KEY) }), status: async () => ({ enabled: true }), userFrom: async () => undefined } as unknown as Community;
  const app = express();
  app.use(express.json());
  app.use('/api', createContractsRouter(community, { env: { SHAM_ADMIN_TOKEN: 'admin-token-123456', SHAM_PUBLIC_API_URL: BASE } }));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const auth = { Authorization: 'Bearer admin-token-123456', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${url}/api/admin/contracts/status`)).status, 401);
    assert.equal((await fetch(`${url}/api/admin/contracts/approved`, { headers: { Authorization: 'Bearer wrong-token-0000000' } })).status, 401);
    const status = await (await fetch(`${url}/api/admin/contracts/status`, { headers: auth })).json();
    assert.equal(status.ready, true);
    assert.equal(status.decision, 'L-40');
    assert.deepEqual(status.senderMissing, []);
    const created = await (await fetch(`${url}/api/admin/contracts`, { method: 'POST', headers: auth, body: JSON.stringify(store()) })).json();
    assert.equal(created.check.ok, true);
    const token = tokenOf(created.contract.signUrl);
    const page = await fetch(`${url}/api/contracts/s/${token}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('x-robots-tag') || '', /noindex/);
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    assert.match(page.headers.get('content-security-policy') || '', /script-src 'nonce-/);
    const html = await page.text();
    assert.doesNotMatch(html, /github\.io|href=/, 'no link to the store on the signing page');
    const view = await (await fetch(`${url}/api/contracts/sign/${token}`)).json();
    assert.equal(view.status, 'viewed');
    const bad = await fetch(`${url}/api/contracts/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ann Owner', title: 'Owner', agree: false, sha256: view.sha256 }) });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).code, 'CONSENT_REQUIRED');
    const ok = await fetch(`${url}/api/contracts/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ann Owner', title: 'Owner', agree: true, sha256: view.sha256 }) });
    assert.equal(ok.status, 200);
    const approve = await fetch(`${url}/api/admin/contracts/${created.contract.id}/approve`, { method: 'POST', headers: auth, body: '{}' });
    assert.equal(approve.status, 409, 'not verified yet');
    assert.equal((await fetch(`${url}/api/admin/contracts/${created.contract.id}/confirm-reply`, { method: 'POST', headers: auth, body: '{}' })).status, 200);
    assert.equal((await fetch(`${url}/api/admin/contracts/${created.contract.id}/approve`, { method: 'POST', headers: auth, body: '{}' })).status, 200);
    const list = await (await fetch(`${url}/api/admin/contracts/approved`, { headers: auth })).json();
    assert.ok(list.stores.some((s: { domain: string }) => s.domain === created.contract.domain));
    assert.equal((await fetch(`${url}/api/admin/contracts/${created.contract.id}/nonsense`, { method: 'POST', headers: auth, body: '{}' })).status, 404);
    const reply = await (await fetch(`${url}/api/admin/contracts/reply`, { method: 'POST', headers: auth, body: JSON.stringify({ message: 'What is your margin?', id: created.contract.id }) })).json();
    assert.equal(reply.check.ok, true);
    // The importer reads the same list with the admin token.
    const fromImporter = await fetchApprovedDomains(url, 'admin-token-123456');
    assert.ok(fromImporter.domains.includes(created.contract.domain));
    assert.equal((await fetchApprovedDomains(url, 'wrong-token-0000000')).domains.length, 0);
  } finally { server.close(); }
});

/* ---------------------------------------------- importer guard & org ---------------------------------------------- */

test('the importer reads only approved stores unless the written permission covers all (L-03 + L-40)', () => {
  const sources = [{ id: 'shamperfume', base: 'https://www.shamperfume.com' }, { id: 'rose', base: 'https://rose.example' }];
  assert.deepEqual(allowedSources(sources, { global: false, approvedDomains: [] }), []);
  assert.deepEqual(allowedSources(sources, { global: false, approvedDomains: ['shamperfume.com'] }).map((s) => s.id), ['shamperfume']);
  assert.deepEqual(allowedSources(sources, { global: false, approvedDomains: ['https://www.rose.example/'] }).map((s) => s.id), ['rose']);
  assert.deepEqual(allowedSources(sources, { global: true, approvedDomains: [] }).length, 2);
  assert.equal(storeDomain('https://www.ShamPerfume.com:443/x'), 'shamperfume.com');
});

test('the org registry: the contracts officer under the legal manager, feeding the importer', () => {
  const bot = BOTS.find((b) => b.id === 'contracts');
  assert.ok(bot?.aiTools?.includes('contracts_agent'));
  assert.ok(LEGAL_DECISIONS.some((d) => d.id === 'L-40' && d.bot === 'contracts'));
  assert.match(LEGAL_DECISIONS.find((d) => d.id === 'L-03')!.textAr, /L-40/);
  assert.ok(LINKS.some((l) => l.from === 'legal' && l.to === 'contracts'));
  assert.ok(LINKS.some((l) => l.from === 'contracts' && l.to === 'importer'));
});
