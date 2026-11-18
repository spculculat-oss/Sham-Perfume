import assert from 'node:assert/strict';
import test from 'node:test';
import { Vault } from '../server/community/crypto';
import { connectPglite, migrate, type Sql } from '../server/community/db';
import * as service from '../server/community/service';
import * as social from '../server/community/social';
import * as admin from '../server/community/admin';
import { classifyCommunityPost } from '../server/community/contentModeration';

const KEY = 'moderation-test-data-key-0123456789';
const fx = async () => ({ base: 'USD', updatedAt: '2026-11-13T00:00:00Z', rates: { USD: 1 } });

test('text moderation catches explicit terms with normalization but leaves ordinary perfumery discussion alone', () => {
  assert.deepEqual(classifyCommunityPost('An explicit porn link is not welcome'), { category: 'explicit_sexual', ruleCode: 'explicit_lexicon_v1' });
  assert.equal(classifyCommunityPost('This perfume has a beautiful rose heart and oud base'), null);
  assert.equal(classifyCommunityPost('What is sex education?'), null, 'generic educational wording is not a match');
  assert.equal(classifyCommunityPost('العطر عكس المتوقع'), null, 'Arabic terms are matched as whole words');
  assert.deepEqual(classifyCommunityPost('كلام قَحْبَة'), { category: 'explicit_sexual', ruleCode: 'explicit_lexicon_v1' });
  assert.deepEqual(classifyCommunityPost('you are a BITCH'), { category: 'obscene_profanity', ruleCode: 'profanity_lexicon_v1' });
});

test('first post violation removes the post and suspends posting; second repeat bans sessions, with audited admin reversal', async () => {
  const sql: Sql = await connectPglite();
  try {
    await migrate(sql);
    const ctx: service.Ctx = { sql, vault: new Vault(KEY), fx, env: {} };
    const email = 'moderation.member@example.com';
    const { me, token } = await service.register(ctx, { name: 'Moderation Member', email, password: 'Sham2026pass', country: 'EG' });

    await assert.rejects(social.createPost(ctx, me.id, { body: 'An explicit porn post' }), { code: 'POST_REMOVED_POSTING_SUSPENDED' });
    const [first] = await sql.query(`SELECT id, status FROM posts WHERE author_id = $1`, [me.id]);
    assert.equal(first.status, 'deleted', 'removed content is no longer visible but retained for accountable review');
    const [state1] = await sql.query(`SELECT moderation_strikes, post_suspended_until, status FROM users WHERE id = $1`, [me.id]);
    assert.equal(Number(state1.moderation_strikes), 1);
    assert.equal(state1.status, 'active', 'first strike does not ban the whole account');
    assert.ok(new Date(state1.post_suspended_until).getTime() > Date.now());
    await assert.rejects(social.createPost(ctx, me.id, { body: 'A clean post during the suspension' }), { code: 'POSTING_SUSPENDED' });
    assert.ok(await service.authenticate(ctx, token), 'first strike retains a valid community session');
  } finally { await sql.close(); }
});

test('a second violation during the first 14-day restriction bans the account and an admin can reverse a false positive', async () => {
  const sql: Sql = await connectPglite();
  try {
    await migrate(sql);
    const ctx: service.Ctx = { sql, vault: new Vault(`${KEY}-second`), fx, env: {} };
    const email = 'moderation.repeat@example.com';
    const { me, token } = await service.register(ctx, { name: 'Repeat Member', email, password: 'Sham2026pass', country: 'EG' });
    await assert.rejects(social.createPost(ctx, me.id, { body: 'A profanity: shit' }), { code: 'POST_REMOVED_POSTING_SUSPENDED' });
    const [case1] = await sql.query(`SELECT id FROM moderation_cases WHERE user_id = $1 ORDER BY created_at`, [me.id]);
    await assert.rejects(social.createPost(ctx, me.id, { body: 'Repeated explicit porn content' }), { code: 'POST_REMOVED_ACCOUNT_BANNED' });
    const [account] = await sql.query(`SELECT status, moderation_strikes FROM users WHERE id = $1`, [me.id]);
    assert.equal(account.status, 'banned');
    assert.equal(Number(account.moderation_strikes), 2);
    assert.equal(await service.authenticate(ctx, token), undefined);
    assert.equal((await sql.query(`SELECT count(*)::int AS n FROM sessions WHERE user_id = $1`, [me.id]))[0].n, 0);
    await assert.rejects(service.login(ctx, { email, password: 'Sham2026pass' }), { code: 'ACCOUNT_BANNED' });

    const cases = await admin.moderationCases(ctx);
    assert.equal(cases.length, 2);
    const secondCase = cases.find((item) => item.strike === 2)!;
    await admin.reviewModerationCase(ctx, secondCase.id, { decision: 'reversed', note: 'Human review: false positive' });
    const [restored] = await sql.query(`SELECT status, moderation_strikes FROM users WHERE id = $1`, [me.id]);
    assert.equal(restored.status, 'active');
    assert.equal(Number(restored.moderation_strikes), 1);
    const [secondPost] = await sql.query(`SELECT status FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 1`, [me.id]);
    assert.equal(secondPost.status, 'visible', 'a reversed case restores the post for admin-reviewed appeal');
    await admin.reviewModerationCase(ctx, case1.id, { decision: 'confirmed', note: 'Human review confirmed' });
    assert.equal((await admin.moderationCases(ctx)).length, 0);
  } finally { await sql.close(); }
});
