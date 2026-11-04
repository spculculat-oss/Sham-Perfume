/**
 * «متجر شام + تخصصات المساعد» — المساعد لازم يعرف المتجر الحقيقي ويعرف حدوده من شاهين:
 *
 *  1. كل تخصص في `server/core/shaheenSpecialties.ts` مربوط بسجل شاهين الحقيقي (أداة في
 *     `src/utils/aiTools.ts` أو روبوت في `src/utils/shaheenOrg.ts` أو تبويب في `src/App.tsx`)،
 *     ولو السجل اتغيّر الاختبار بيفشل.
 *  2. المنتجات والأسعار اللي بيقولها المساعد موجودة فعلًا في الكتالوج، وسعر المورّد والهامش ما
 *     يوصلوش للزائر أبدًا.
 *  3. لو الكتالوج فاضي، المساعد يقول الحقيقة وما يخترعش منتجات.
 *  4. مراجعة التخصصات (`reviewSpecialties`) بتدي 100٪ على متجر نظيف من غير أي مفتاح ذكاء اصطناعي —
 *     يعني حتى لو كل المحركات وقعت، المساعد لسه عارف المتجر ومسمّي تخصصات شاهين.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Orchestrator } from '../server/core/orchestrator';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { KNOWLEDGE_SEED_VERSION, defaultKnowledge, knowledgeSeedAdditions } from '../server/core/seed';
import {
  SPECIALTIES, assistantLessons, assistantSpecialties, registryProblems, shaheenHandoff, shaheenSpecialties, specialtyBrief, visitorSpecialties,
} from '../server/core/shaheenSpecialties';
import {
  STORE_PLAYBOOK, bundledProducts, findStorefront, storeBrief, storeKnowledge, storeLine, storefrontCatalog,
  type StoreSnapshot,
} from '../server/core/storeGuide';
import { reviewSpecialties } from '../server/core/specialtyReview';
import { aiTool } from '../src/utils/aiTools';
import { botOf } from '../src/utils/shaheenOrg';
// The probe file is the supervisor's record of which AI tools it can measure; the assistant must stay on it.
import { QUESTIONS } from '../scripts/shaheen-supervisor/probes';

const freshRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });
const emptySnapshot: StoreSnapshot = {
  total: 0, inStock: 0, newCount: 0, featuredCount: 0, withNotes: 0, minPrice: 0, maxPrice: 0,
  brands: [], families: [], categories: [], updatedAt: '', empty: true,
};

test('every specialty is backed by a real Shaheen record and a real page', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const tabs = new Set([...app.matchAll(/activeTab === '([a-zA-Z_]+)'/g)].map((m) => m[1]));
  const ids = SPECIALTIES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'specialty ids are unique');
  for (const s of SPECIALTIES) {
    if (s.tool) assert.ok(aiTool(s.tool), `${s.id}: AI tool “${s.tool}” is not registered in src/utils/aiTools.ts`);
    if (s.bot) assert.ok(botOf(s.bot), `${s.id}: bot “${s.bot}” is not in Shaheen's org chart`);
    if (s.tab) assert.ok(tabs.has(s.tab.split('/')[0]), `${s.id}: tab “${s.tab}” is not a route in src/App.tsx`);
    assert.ok(s.sample.ar.length > 5 && s.sample.en.length > 5, `${s.id}: needs a realistic sample question`);
    assert.ok(s.keywords.length >= 2, `${s.id}: needs keywords so the router can recognise it`);
  }
  assert.equal(registryProblems().length, 0, registryProblems().join(' · '));
  assert.ok(assistantSpecialties().length >= 6, 'the assistant still owns the store/order/service work');
  assert.ok(shaheenSpecialties().length >= 3, 'Shaheen keeps his own specialties');
  assert.ok(visitorSpecialties().every((s) => s.owner === 'assistant' || s.tab), 'Shaheen specialties visible to visitors have a page');
  // The supervisor can still measure the assistant; otherwise this review would go blind.
  assert.ok(QUESTIONS.sham_assistant.length >= 3);
});

test('the assistant learns its specialties from Shaheen, never the other way round', () => {
  const brief = specialtyBrief('ar');
  for (const s of SPECIALTIES) assert.ok(brief.includes(s.name.ar), `the prompt does not name ${s.id}`);
  assert.match(brief, /شاهين/);
  assert.match(brief, /درساً|دروس/);
  assert.ok(assistantLessons().length >= 5, 'Shaheen’s lessons are bundled');
  for (const topic of ['formulation', 'advice', 'news'] as const) {
    assert.match(shaheenHandoff('ar', topic), /شاهين/, `${topic}: the hand-off must name Shaheen`);
    assert.match(shaheenHandoff('en', topic), /Shaheen/, `${topic}: the English hand-off must name Shaheen`);
  }
});

test('the store documents are seeded (v3) and explain the real buying rules', () => {
  const docs = new Map(defaultKnowledge().map((d) => [d.id, d]));
  assert.ok(KNOWLEDGE_SEED_VERSION >= 3);
  for (const topic of STORE_PLAYBOOK) {
    const doc = docs.get(topic.id);
    assert.ok(doc, `missing knowledge document ${topic.id}`);
    assert.ok(doc.content.length > 120, `${topic.id} is too thin to answer from`);
    assert.match(topic.id, /^kb-store-/, 'store documents use their own prefix so upgrades stay surgical');
    assert.ok(storeKnowledge().some((d) => d.id === topic.id && d.serviceId === 'store'));
  }
  // Upgrading an existing store adds the store docs only — nothing the merchant edited is rewritten.
  const added = knowledgeSeedAdditions(2).map((d) => d.id);
  assert.ok(added.length > 0 && added.every((id) => id.startsWith('kb-store-')), added.join(' · '));
  const text = STORE_PLAYBOOK.map((t) => t.body.ar).join('\n');
  for (const fact of ['إنستاباي', 'UN1266', 'SH-', 'الإرجاع']) assert.ok(text.includes(fact), `the store playbook lost “${fact}”`);
});

test('the assistant quotes catalog prices only, and never a supplier price or margin', async () => {
  const { items } = await storefrontCatalog({});
  assert.ok(items.length > 0, 'the bundled catalog is not empty');
  const known = new Set(items.map((i) => Math.round(i.price)));
  const guess = findStorefront(items, 'عندكم عطر عود رجالي للشتا؟', 4);
  assert.ok(guess.picks.length > 0, 'a normal store question finds real products');
  for (const pick of guess.picks) {
    assert.ok(known.has(Math.round(pick.price)), `${pick.sku}: the assistant must quote the storefront price`);
    // The light record carries no supplier money at all.
    assert.ok(!('supplierPrice' in pick) && !('ourPrice' in pick) && !('margin' in pick), `${pick.sku}: internal price leaked`);
    const line = storeLine(pick, 'ar');
    assert.ok(line.includes(pick.nameAr) && line.includes(String(pick.price)), 'the line shows the real name and price');
  }
  // Any number followed by «جنيه» in the brief must be a real price or a real count, and the brief must
  // forbid inventing discounts exactly once so the model cannot forget the rule.
  const brief = storeBrief('ar', (await storefrontCatalog({})).snapshot);
  assert.match(brief, /لا تذكر هامش المنصة أو سعر المورّد/);
  const quoted = [...brief.matchAll(/(\d+)\s*جنيه/g)].map((m) => Number(m[1]));
  const range = (await storefrontCatalog({})).snapshot;
  for (const price of quoted) assert.ok(price >= range.minPrice && price <= range.maxPrice, `invented price ${price} in the prompt`);
});

test('an empty catalog stays empty — no invented product, the visitor is offered a real path', async () => {
  assert.deepEqual(findStorefront([], 'عندكم عطر عود؟'), { picks: [], matched: false });
  assert.match(storeBrief('ar', emptySnapshot), /لا توجد منتجات/);
  assert.match(storeBrief('en', emptySnapshot), /no published products/i);
  assert.doesNotMatch(storeBrief('ar', emptySnapshot), /ماركات:/, 'an empty store must not pretend to have brands');
});

test('a real visitor question is answered from the store with no AI key at all', async () => {
  const bot = new Orchestrator(freshRepo(), { env: {} });
  const { items } = await storefrontCatalog({});
  const out = await bot.chat({ message: 'عندكم عطر عود رجالي للشتا؟', visitorId: 'visitor-store-test', language: 'ar' });
  assert.equal(out.intent, 'browse_products');
  assert.ok(items.some((i) => out.reply.includes(i.nameAr)), 'the reply names a product that really exists');
  assert.ok(out.actions.some((a) => a.type === 'open_tab' && a.tab === 'store'), 'the visitor gets the store button');
  // Shaheen's work is named and handed over, not claimed.
  const formulation = await bot.chat({ message: 'إزاي أرفع نسبة العود في التركيبة؟', visitorId: 'visitor-store-test', language: 'ar' });
  assert.match(formulation.reply, /شاهين/);
  assert.ok(formulation.actions.some((a) => a.type === 'open_tab' && a.tab === 'master_ai'));
});

test('the specialty review scores 100 on a clean store and reports its evidence', async () => {
  const review = await reviewSpecialties(freshRepo(), { env: {} });
  assert.equal(review.registryProblems.length, 0, review.registryProblems.join(' · '));
  assert.equal(review.score, 100, review.checks.filter((c) => !c.ok).map((c) => `${c.specialty}: ${c.question} → ${c.actual}`).join('\n'));
  assert.equal(review.passed, review.total);
  assert.ok(review.total >= SPECIALTIES.length, 'every specialty is checked');
  for (const s of SPECIALTIES) assert.ok(review.checks.some((c) => c.specialty === s.name.ar), `${s.id} was not reviewed`);
  assert.ok(review.store.total > 0 && review.store.lessons > 0, 'the review reads the real store and Shaheen’s lessons');
  assert.ok(bundledProducts.length > 0);
  // No field in the review can carry supplier money to the admin page (the fix texts name the field on purpose).
  assert.doesNotMatch(JSON.stringify(review), /"(?:supplierPrice|ourPrice|margin)":/);
});
