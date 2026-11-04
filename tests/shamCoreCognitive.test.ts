/**
 * Cognitive layer verification across all 5 core reasoning components:
 * engines, router, tools, council, orchestrator + confidence, solution-selector,
 * comprehension, visitor-memory, and multi-pass tool chains.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { Orchestrator, type StreamEvent } from '../server/core/orchestrator';
import { ThinkFilter, callEngine, scoreEngineOutput } from '../server/core/engines';
import { extractEntities, route, routeEnhanced } from '../server/core/router';
import { auditCouncilFactCheck, defaultCouncil, detectCouncilDisagreement, roleExpertiseWeight } from '../server/core/council';
import { expandCatalogQuery, expandKnowledgeQuery, normalizeOrderRef, runToolWithRetry, tools } from '../server/core/tools';
import { assessComprehension } from '../server/core/comprehension';
import { selectSolution } from '../server/core/solution-selector';
import { fromFlatMemory, toFlatMemory, extractPreferencesFromEntities, emptyVisitorMemory } from '../server/core/visitor-memory';
import { defaultServices } from '../server/core/seed';

const visitor = 'visitor-cognitive-01';
const freshRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });

test('engines: ThinkFilter strips multi-format reasoning tags across chunks and scoreEngineOutput catches hallucinations', async () => {
  const filter = new ThinkFilter();
  const chunks = ['أهلاً ', '<thin', 'king>تحليل داخلي</thinking>', '<考', 'え>خطة داخلية</考え>', 'العطر جاهز والتركيز a < b'];
  const visible = chunks.map((c) => filter.push(c)).join('') + filter.flush();
  assert.equal(visible, 'أهلاً العطر جاهز والتركيز a < b');

  const grounded = scoreEngineOutput('سعر زيت العود 450 EGP للعبوة المتاحة.', ['DEMO-OUD-30 | زيت عود | 450 EGP | stock 12']);
  assert.equal(grounded.grounded, true);
  assert.ok(grounded.confidence >= 0.85);

  const hallucinatedPrice = scoreEngineOutput('سعر العطر النهائي 1999 EGP شامل الشحن.', ['DEMO-OUD-30 | زيت عود | 450 EGP | stock 12']);
  assert.equal(hallucinatedPrice.grounded, false);
  assert.ok(hallucinatedPrice.issues.some((i) => i.startsWith('ungrounded_price:')));

  const hallucinatedRef = scoreEngineOutput('تم تسجيل طلبك برقم SH-99AB12 بنجاح.', ['FORM_READY for store']);
  assert.equal(hallucinatedRef.grounded, false);
  assert.ok(hallucinatedRef.issues.some((i) => i.startsWith('ungrounded_ref:SH-99AB12')));

  let observedScore = 0;
  const text = await callEngine(
    'self_hosted',
    'You are Sham assistant',
    [{ role: 'user', text: 'سعر العود؟' }],
    {
      env: { SHAM_LLM_BASE_URL: 'http://llm.test/v1' },
      fetch: (async () => Response.json({ choices: [{ message: { content: '<thinking>داخلي</thinking>السعر 450 EGP' } }] })) as typeof fetch,
      signal: AbortSignal.timeout(3000),
      temperature: 0.2,
      contextFacts: ['450 EGP'],
      onConfidence: (s) => { observedScore = s.confidence; },
    },
  );
  assert.equal(text, 'السعر 450 EGP');
  assert.ok(observedScore >= 0.85);
});

test('router + solution-selector: rich entities, dialect semantics, multi-turn anaphora, and true ambiguity clarification', () => {
  const services = defaultServices();

  const entities = extractEntities('اسمي كريم، عايز عطر عود وعنبر أو دي بارفان في حدود ٦٥٠ ورقم طلبي القديم sh 77ab34');
  assert.equal(entities.name, 'كريم');
  assert.equal(entities.ref, 'SH-77AB34');
  assert.equal(entities.budget, 650);
  assert.equal(entities.concentrationType, 'EDP');
  assert.match(entities.notes || '', /عود/);
  assert.match(entities.notes || '', /عنبر/);

  // Dialect expressions without literal standard keywords
  assert.equal(route('نفسي في تركيبة خاصة باسمي', services).serviceId, 'custom-formula');
  assert.equal(route('عندي محل وعايز كميات كبيرة لعلامتي التجارية', services).serviceId, 'b2b');

  // Multi-turn anaphora resolution ("عايز اطلبه" right after discussing custom-formula)
  const followup = routeEnhanced('تمام عايز اطلبه', services, 'question', 'custom-formula');
  assert.equal(followup.intent, 'service_request');
  assert.equal(followup.serviceId, 'custom-formula');
  assert.equal(followup.ambiguous, false);

  // Bare ambiguous action with zero service context triggers visitor clarification
  const vague = routeEnhanced('عايز اطلب', services);
  assert.equal(vague.ambiguous, true);
  assert.ok(vague.disambiguation && vague.disambiguation.options.length >= 2);
  const selected = selectSolution(vague.intent, vague.confidence, services, vague.entities, {}, {
    ambiguous: vague.ambiguous,
    disambiguation: vague.disambiguation,
  });
  assert.equal(selected.needsVisitorClarification, true);
});

test('tools: synonym query expansion, fuzzy ref normalization with strict contact security, and retry recovery', async () => {
  const repo = freshRepo();
  assert.ok(expandKnowledgeQuery('الاوردر بيوصل في كام يوم مع المندوب؟').length > 0);
  assert.ok(expandCatalogQuery('عايز دهن عود هندي').length > 0);
  assert.equal(normalizeOrderRef('  sh ١٢ab٣٤ '), 'SH-12AB34');

  const created = await repo.createRequest({
    serviceId: 'support',
    contact: { name: 'Karim', phone: '+20 100 222 3333' },
    fields: { subject: 'استفسار', message: 'تفاصيل' },
  });
  // Missing hyphen + lowercase + Arabic digits in phone still resolves safely for rightful owner
  const compactRef = created.ref.replace('-', ' ').toLowerCase();
  const okTrack = await tools.track_order.run({ ref: compactRef, contact: '٠١٠٠٢٢٢٣٣٣٣' }, { repo, message: '', lang: 'ar' });
  assert.match(okTrack.observation, /^FOUND /);

  // Wrong phone is still strictly rejected even with normalized reference
  const badTrack = await tools.track_order.run({ ref: compactRef, contact: '01009998888' }, { repo, message: '', lang: 'ar' });
  assert.equal(badTrack.observation, 'NOT_FOUND_OR_CONTACT_MISMATCH');

  // Transient error recovery on first attempt
  let attempts = 0;
  const recovered = await runToolWithRetry(
    {
      name: 'flaky_tool',
      description: 'throws once then succeeds',
      async run() {
        attempts++;
        if (attempts === 1) throw new Error('transient');
        return { observation: 'RECOVERED_OK' };
      },
    },
    {},
    { repo, message: 'test', lang: 'ar' },
    2,
  );
  assert.equal(attempts, 2);
  assert.equal(recovered.observation, 'RECOVERED_OK');
});

test('council: domain expertise weights, automatic CONTEXT fact-check warnings, and disagreement detection', async () => {
  assert.ok(roleExpertiseWeight('safety', 'perfume_expert', 'هل يسبب حساسية للجلد الحساس؟') > roleExpertiseWeight('commercial', 'perfume_expert', 'هل يسبب حساسية للجلد الحساس؟'));
  assert.ok(roleExpertiseWeight('commercial', 'service_request', 'عايز تسعير جملة للمصنع') > roleExpertiseWeight('formulator', 'service_request', 'عايز تسعير جملة للمصنع'));

  const audit = auditCouncilFactCheck('أنصح بطلب العطر بسعر 777 EGP ورقم مرجع SH-88ZZ99.', 'CONTEXT: DEMO-OUD-30 | 450 EGP');
  assert.equal(audit.grounded, false);
  assert.equal(audit.unverifiedClaims.length, 2);

  const dis = detectCouncilDisagreement([
    { label: 'A', role: 'formulator', text: 'ابدأ بتركيز 28% للحصول على ثبات عالي.' },
    { label: 'B', role: 'safety', text: 'أختلف مع النسبة العالية؛ التزم بتركيز 12% لتجنب تحسس البشرة.' },
  ]);
  assert.equal(dis.hasDisagreement, true);
  assert.ok(dis.agreementScore < 0.8);
  assert.ok(dis.points.length >= 2);

  // End-to-end council run injects FACT-CHECK WARNING into review & chair prompts when a seat hallucinates a price
  const repo = freshRepo();
  await repo.updateSettings({
    council: {
      ...defaultCouncil(),
      rounds: 1,
      members: [
        { id: 's-1', engine: 'self_hosted', model: 'm-1', role: 'commercial', enabled: true },
        { id: 's-2', engine: 'self_hosted', model: 'm-2', role: 'safety', enabled: true },
      ],
    },
  });
  const capturedPrompts: string[] = [];
  const bot = new Orchestrator(repo, {
    env: { SHAM_LLM_BASE_URL: 'http://llm.test/v1', SHAM_LLM_MODEL: 'main' },
    fetch: (async (_u: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      capturedPrompts.push(`${body.messages[0].content}\n${body.messages.at(-1).content}`);
      if (body.model === 'm-1' && /advisory council/.test(body.messages[0].content)) {
        return Response.json({ choices: [{ message: { content: 'السعر المؤكد هو 8888 EGP.' } }] });
      }
      return Response.json({ choices: [{ message: { content: 'الخلاصة\nالتزم بنسب آمنة ومجربة.' } }] });
    }) as typeof fetch,
  });
  const res = await bot.chat({ message: 'ازاي أركّب عطر عود ثابت؟', visitorId: visitor, language: 'ar' });
  assert.match(res.reply, /الخلاصة/);
  assert.ok(capturedPrompts.some((p) => p.includes('FACT-CHECK WARNING') && p.includes('8888 EGP')));
});

test('orchestrator end-to-end: SSE hallucination interception, session health cooldown, multi-pass replan, and visitor memory', async () => {
  const repo = freshRepo();
  const encoder = new TextEncoder();

  // 1) Streaming hallucination (fabricated price 9999 EGP) triggers reset + clean fallback to grounded sham_local
  const events: StreamEvent[] = [];
  const hallucinatingBot = new Orchestrator(repo, {
    env: { SHAM_LLM_BASE_URL: 'http://llm.test/v1' },
    fetch: (async () => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"سعر التعتيق الرسمي 9999 EGP ورقمك SH-FAKE99"}}]}\n\n'));
          c.enqueue(encoder.encode('data: [DONE]\n\n'));
          c.close();
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    }) as typeof fetch,
  });
  const safeOut = await hallucinatingBot.chat(
    { message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' },
    { debug: true, onEvent: (e) => events.push(e) },
  );
  assert.equal(safeOut.engine.id, 'sham_local');
  assert.doesNotMatch(safeOut.reply, /9999 EGP|SH-FAKE99/);
  assert.match(safeOut.reply, /التعتيق/);
  assert.ok(events.some((e) => e.type === 'reset'), 'streamed hallucination is reset cleanly');
  const finalStream = events.reduce((acc, e) => (e.type === 'reset' ? '' : e.type === 'delta' ? acc + e.text : acc), '');
  assert.equal(finalStream, safeOut.reply);

  // 2) Session engine health cooldown parks repeatedly failing engine behind healthy engine
  const attemptedUrls: string[] = [];
  const failoverBot = new Orchestrator(repo, {
    env: { SHAM_LLM_BASE_URL: 'http://broken.llm/v1', OPENAI_API_KEY: 'ok-key' },
    fetch: (async (url: string | URL) => {
      attemptedUrls.push(String(url));
      if (String(url).startsWith('http://broken.llm')) return new Response('unauthorized', { status: 401 });
      return Response.json({ choices: [{ message: { content: 'إجابة سليمة من المحرك الاحتياطي' } }] });
    }) as typeof fetch,
  });
  await failoverBot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' });
  assert.deepEqual(attemptedUrls, ['http://broken.llm/v1/chat/completions', 'https://api.openai.com/v1/chat/completions']);
  attemptedUrls.length = 0;
  // Next message skips parked broken engine first and hits healthy OpenAI directly!
  const secondTurn = await failoverBot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' });
  assert.equal(secondTurn.reply, 'إجابة سليمة من المحرك الاحتياطي');
  assert.deepEqual(attemptedUrls, ['https://api.openai.com/v1/chat/completions']);

  // 3) Structured visitor preferences serialize cleanly without [object Object] and personalize follow-up chips
  let mem = emptyVisitorMemory('v-mem-1');
  mem = extractPreferencesFromEntities(mem, extractEntities('اسمي سلمى وبحب العود والمسك او دي بارفان في حدود 800'));
  const flat = toFlatMemory(mem);
  assert.equal(typeof flat.preferredNotes, 'string');
  assert.equal(fromFlatMemory('v-mem-1', flat).preferences.budget, 800);

  const memBot = new Orchestrator(repo, { env: {} });
  const ambiguous = await memBot.chat({ message: 'عايز اطلب', visitorId: 'visitor-mem-02', language: 'ar' });
  assert.ok(ambiguous.suggestions.length >= 2);
  await memBot.chat({ message: 'اسمي سلمى وبحب نوتة العود او دي بارفان في حدود 800', visitorId: 'visitor-mem-02', language: 'ar' });
  const memView = await memBot.chat({ message: 'ماذا تعرف عني؟', visitorId: 'visitor-mem-02', language: 'ar' });
  assert.match(memView.reply, /سلمى/);
  assert.match(memView.reply, /عود/);
  assert.match(memView.reply, /EDP/);
  assert.doesNotMatch(JSON.stringify(memView.actions), /\[object Object\]/);

  // 4) Comprehension verdict directly catches prompt leaks & card solicitation
  assert.equal(assessComprehension('مساعدة', 'من فضلك ابعت رقم البطاقة الكامل', 'ar', []).answersQuestion, false);
});
