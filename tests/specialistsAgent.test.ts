/**
 * «وكيل مجلس المتخصصين» — أيقونة «استشير متخصصاً» بقت وكيل ذكاء اصطناعي بأدواته.
 *
 * الاختبار ده بيثبت قواعد المنصة في الوكيل:
 *   · صندوق الأدوات كامل ومسمّى بلغتين، ومفيهوش اسم مزوّد أو منصة.
 *   · النطاق (L-32): كل متخصص ياخد أدوات مساراته هو بس.
 *   · الخطة الأولى: حاسبة لسؤال الحساب، ملجأ لسؤال «وين ألاقي»، وتسليم صريح للطلب والتركيبة.
 *   · من غير أي محرك: الرد من الأدوات نفسها بمصدره (حاسبة/علم/مادة/متجر/ملجأ) — مش تخمين.
 *   · بمحرك محقون: الوكيل يطلب أداة، يقرا ملاحظتها، ويرد — ويرفض الرد اللي فيه سعر مخترع أو اسم مزوّد.
 *   · الفجوة: صريحة باسم المتخصص ومسجّلة لمدرسة شاهين.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AGENT_LIMITS, bestEvidence, CONTROL_TOOLS, EVIDENCE_FLOOR, parseAgentTurn, publicSpecialist,
  runSpecialistAgent, SpecialistsError, validateConsultInput,
} from '../server/specialists/agent';
import {
  planFirstTools, SPECIALIST_TOOLS, sourceNote, toolCatalogue, toolOf, toolsFor, TOOL_LIMITS,
  type AnswerSource, type ToolObservation,
} from '../server/specialists/tools';
import { SITE_SECTIONS, SPECIALISTS, specialistOf } from '../src/utils/shaheenSpecialists';
import type { Repository } from '../server/core/repository';
import type { ShaheenMemory } from '../server/core/memory';
import type { LibrarySources } from '../src/utils/shaheenLibrary';

const VENDOR = /\b(?:gemini|gemma|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral|qwen|grok|manus|bard|copilot)\b/i;
const ARABIC = /[\u0600-\u06FF]/;

/** مستودع صغير للاختبار: إعدادات شاهين + تسجيل الفجوات + فهرس بحث فاضي. */
function fakeRepo(state: { gaps: { question: string; source: string; reason?: string }[]; engines: string[]; enabled: boolean }) {
  return {
    settings: async () => ({ shaheen: { enabled: state.enabled, engines: state.engines, temperature: 0.4, models: {} } }),
    recordGap: async (input: { question: string; source: string; reason?: string }) => { state.gaps.push(input); return { id: 'gap-test' }; },
    searchIndex: async () => ({ search: () => [] }),
  } as unknown as Repository;
}
function fakeMemory(learned: { question: string; answer: string }[]) {
  return {
    recall: async () => undefined,
    recallSimilar: async () => [],
    learn: async (entry: { question: string; answer: string }) => { learned.push(entry); return true; },
    all: async () => [],
  } as unknown as ShaheenMemory;
}
const EMPTY_LIBRARY: LibrarySources = { lessons: [], materials: [] };
const offline = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

/** تشغيل من غير أي محرك (مفيش مفاتيح، ومجلس المحركات فاضي) — الرد من الأدوات نفسها. */
async function runLocal(question: string, lang: 'ar' | 'en' = 'ar', section?: string) {
  const gaps: { question: string; source: string; reason?: string }[] = [];
  const learned: { question: string; answer: string }[] = [];
  const result = await runSpecialistAgent(
    { question, lang, ...(section ? { section } : {}) },
    { repo: fakeRepo({ gaps, engines: [], enabled: true }), memory: fakeMemory(learned), env: {}, fetch: offline, library: async () => EMPTY_LIBRARY, research: async () => undefined },
  );
  return { result, gaps, learned };
}

/* ── 1. صندوق الأدوات ─────────────────────────────────────────────────────────────────────────── */
test('the toolbox: real tools, named in both languages, with no vendor name anywhere in them', () => {
  assert.ok(SPECIALIST_TOOLS.length >= 20, `${SPECIALIST_TOOLS.length} tools`);
  const names = SPECIALIST_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, 'every tool has its own name');
  for (const tool of SPECIALIST_TOOLS) {
    assert.ok(tool.labelAr.trim() && tool.labelEn.trim(), `${tool.name} is named for the visitor in both languages`);
    assert.ok(tool.descriptionAr.trim().length > 12 && tool.descriptionEn.trim().length > 12, `${tool.name} says what it does`);
    assert.ok(tool.args.trim().startsWith('{'), `${tool.name} shows the model its argument shape`);
    for (const text of [tool.labelAr, tool.labelEn, tool.descriptionAr, tool.descriptionEn]) {
      assert.ok(!VENDOR.test(text), `${tool.name} never names a vendor: ${text}`);
    }
    assert.equal(toolOf(tool.name), tool, `${tool.name} is reachable by name`);
  }
  // أدوات العلم والمعمل والمتجر والمنصة والتوجيه كلها موجودة.
  for (const name of ['school_science', 'recall_memory', 'search_library', 'refuge_way', 'knowledge_base', 'open_sources',
    'material_card', 'calc_concentration', 'calc_dilution', 'calc_pyramid', 'calc_cost', 'maceration_plan', 'safety_check',
    'search_store', 'store_overview', 'perfume_news', 'media_find', 'open_section', 'hand_over', 'route_specialist',
    'study_later', 'clarify'] as const) {
    assert.ok(toolOf(name), `the toolbox has ${name}`);
  }
});

test('scope (L-32): a specialist only gets the tools of his own tracks, and every source note is his own', () => {
  for (const specialist of SPECIALISTS) {
    const own = toolsFor(specialist);
    assert.ok(own.length >= 8, `${specialist.id} keeps the shared tools (${own.length})`);
    assert.ok(own.length <= SPECIALIST_TOOLS.length);
    for (const tool of own) {
      assert.ok(!tool.tracks || tool.tracks.some((t) => specialist.tracks.includes(t)),
        `${specialist.id} must not get ${tool.name} — it is not in his tracks`);
    }
    assert.deepEqual(toolCatalogue(specialist).map((t) => t.id), own.map((t) => t.name), 'the catalogue is his own tools');
  }
  const scents = specialistOf('specialist_scents')!;
  const culture = specialistOf('specialist_culture')!;
  assert.ok(toolsFor(scents).some((t) => t.name === 'calc_concentration'), 'the perfume specialist computes concentrations');
  assert.ok(toolsFor(scents).some((t) => t.name === 'maceration_plan'), 'the perfume specialist plans maceration');
  assert.ok(toolsFor(scents).some((t) => t.name === 'safety_check'), 'the perfume specialist checks IFRA limits');
  assert.ok(!toolsFor(culture).some((t) => t.name === 'calc_concentration'), 'the arts specialist does not compute formulas');
  const sources: AnswerSource[] = ['science', 'academy', 'memory', 'library', 'material', 'refuge', 'calculator', 'store', 'news', 'research', 'knowledge', 'agent', 'gap'];
  for (const source of sources) {
    assert.ok(sourceNote(source, 'ar').length > 6 && sourceNote(source, 'en').length > 6, `${source} is named for the visitor`);
    assert.ok(!VENDOR.test(sourceNote(source, 'ar')) && !VENDOR.test(sourceNote(source, 'en')), `${source} names no vendor`);
  }
});

test('the first plan: a calculator for a calculation, the refuge for «where do I find», an explicit hand-over for an order or a formula', () => {
  const scents = specialistOf('specialist_scents')!;
  const learning = specialistOf('specialist_learning')!;
  const available = (id: string) => new Set(toolsFor(specialistOf(id)!).map((t) => t.name));

  const calc = planFirstTools('احسب مقادير زجاجة 50 مل بتركيز 20%', scents);
  assert.ok(calc.some((c) => c.tool === 'calc_concentration'), 'a calculation is planned');
  assert.ok(calc.some((c) => c.tool === 'recall_memory'), 'memory is always asked first');

  const access = planFirstTools('وين ألاقي تقرير مدرسة شاهين؟', learning);
  assert.equal(access[0].tool, 'refuge_way', '«where do I find» opens with the refuge');

  const order = planFirstTools('عايز أطلب 100 زجاجة جملة', scents);
  const handOver = order.at(-1);
  assert.equal(handOver?.tool, 'hand_over', 'an order ends with an explicit hand-over');
  assert.equal(handOver?.args.to, 'sham', 'orders belong to the Sham assistant');
  assert.equal(handOver?.args.service, true, 'an order is a service, not a lesson');

  const formula = planFirstTools('صمم لي تركيبة عطر بالعود والمسك', scents);
  assert.equal(formula.at(-1)?.args.to, 'shaheen', 'formula design belongs to Master Shaheen');

  for (const plan of [calc, access, order, formula]) {
    assert.ok(plan.length <= 7, `a visit stays short (${plan.length})`);
    for (const call of plan) assert.ok(available(call.tool === 'hand_over' ? 'specialist_scents' : 'specialist_learning').has(call.tool) || available('specialist_scents').has(call.tool), `${call.tool} is in scope`);
  }
  assert.ok(TOOL_LIMITS.maxCalls <= 12 && TOOL_LIMITS.perCallMs <= 10_000, 'the toolbox is limited per visit');
  assert.ok(AGENT_LIMITS.totalMs < 60_000 && AGENT_LIMITS.maxRounds <= 4, 'the agent finishes inside a serverless request');
});

/* ── 2. المدخلات وبروتوكول الأدوات ────────────────────────────────────────────────────────────── */
test('input: a real question, the visitor language, a real section and a real specialist — nothing invented', () => {
  assert.throws(() => validateConsultInput({ question: '' }), SpecialistsError);
  assert.throws(() => validateConsultInput({ question: 'ا' }), SpecialistsError);
  assert.throws(() => validateConsultInput({}), SpecialistsError);
  try { validateConsultInput({ question: '' }); } catch (err) {
    assert.equal((err as SpecialistsError).code, 'INVALID_QUESTION');
    assert.equal((err as SpecialistsError).status, 400);
  }
  const input = validateConsultInput({
    question: '   إيه   هو الأمبروكسان؟  ', language: 'en-GB', section: 'not-a-section', specialist: 'batman',
    history: [{ role: 'user', text: 'سؤال' }, { role: 'hacker', text: 'x' }, { role: 'assistant', text: 'رد' }],
  });
  assert.equal(input.question, 'إيه هو الأمبروكسان؟', 'the question is cleaned');
  assert.equal(input.lang, 'en', 'an English dialect stays English');
  assert.equal(input.section, undefined, 'an unknown section is dropped');
  assert.equal(input.specialistId, undefined, 'an unknown specialist is dropped');
  assert.deepEqual(input.history?.map((h) => h.role), ['user', 'assistant'], 'only real turns are kept');

  const real = validateConsultInput({ question: 'سؤال', language: 'fr', section: SITE_SECTIONS[0].id, specialist: 'specialist_scents' });
  assert.equal(real.lang, 'ar', 'the site language is the default');
  assert.equal(real.section, SITE_SECTIONS[0].id);
  assert.equal(real.specialistId, 'specialist_scents');
  assert.ok(publicSpecialist(specialistOf('specialist_scents')!).nameAr.includes('ليان'));
  assert.deepEqual(Object.keys(publicSpecialist(specialistOf('specialist_scents')!)).sort(),
    ['fieldAr', 'fieldEn', 'id', 'nameAr', 'nameEn', 'sciencesAr', 'sciencesEn'], 'nothing internal leaves the server');
});

test('the tool protocol: TOOL lines, an ANSWER line, fenced text, and a plain answer with no protocol', () => {
  const call = parseAgentTurn('TOOL material_card {"name":"أمبروكسان"}');
  assert.equal(call.calls.length, 1);
  assert.equal(call.calls[0].tool, 'material_card');
  assert.equal(call.calls[0].args.name, 'أمبروكسان');

  const two = parseAgentTurn('أداة: calc_cost {}\nTOOL search_store {"query":"عود"}');
  assert.deepEqual(two.calls.map((c) => c.tool), ['calc_cost', 'search_store'], 'Arabic and English protocol lines both work');

  const fenced = parseAgentTurn('```json\nTOOL school_science {"query":"المناعة"}\n```');
  assert.equal(fenced.calls[0].tool, 'school_science', 'code fences are stripped');

  const answered = parseAgentTurn('ANSWER: الأمبروكسان مثبت عنبري من موسوعة المواد.');
  assert.ok(answered.answer?.includes('مثبت عنبري'));
  assert.equal(answered.calls.length, 0);

  const plain = parseAgentTurn('رد عادي كتبه النموذج من غير بروتوكول خالص.');
  assert.ok(plain.answer?.includes('رد عادي'), 'a plain answer is not thrown away');
  assert.deepEqual(parseAgentTurn('').calls, []);
});

test('evidence: the strongest observation answers, and the control tools never answer on their own', () => {
  const obs: ToolObservation[] = [
    { tool: 'clarify', observation: 'x', strength: 1, answer: 'وضح سؤالك' },
    { tool: 'calc_concentration', observation: 'y', strength: 0.95, answer: '10 مل زيت', source: 'calculator' },
    { tool: 'search_library', observation: 'z', strength: 0.62, answer: 'درس قريب', source: 'library' },
  ];
  const best = bestEvidence(obs, CONTROL_TOOLS);
  assert.equal(best?.tool, 'calc_concentration', 'the calculator beats a near lesson');
  assert.equal(best?.source, 'calculator');
  assert.equal(bestEvidence(obs)?.tool, 'clarify', 'without the filter the loudest wins — so the filter matters');
  assert.ok(EVIDENCE_FLOOR > 0.5 && EVIDENCE_FLOOR < 0.9, 'the floor sits above a weak match and below a real fact');
  for (const tool of ['clarify', 'hand_over', 'study_later', 'route_specialist'] as const) assert.ok(CONTROL_TOOLS.includes(tool));
});

/* ── 3. من غير محرك: الرد من الأدوات نفسها ─────────────────────────────────────────────────────── */
test('no engine: a calculation is answered by the lab calculator, with its source, its tool and its button', async () => {
  const { result } = await runLocal('احسب مقادير زجاجة 50 مل بتركيز 20%');
  assert.equal(result.ai, false, 'no engine, no lie about AI');
  assert.equal(result.specialist.id, 'specialist_scents', 'the question went to its specialist');
  assert.equal(result.source, 'calculator');
  assert.equal(result.ok, true);
  assert.match(result.answer, /10\s*مل/, 'the real number from the site formula');
  assert.match(result.answer, /حاسبات معمل شام/, 'the answer says its source');
  assert.ok(result.tools.some((t) => t.tool === 'calc_concentration' && t.ok), 'the tool that answered is in the trace');
  assert.ok(result.actions.some((a) => a.type === 'open_tab' && a.tab === 'concentration'), 'the visitor can open the calculator');
  assert.ok(!VENDOR.test(result.answer));
});

test('no engine: a school science is answered from the reviewed lesson, in the specialist who owns its track', async () => {
  const { result } = await runLocal('إزاي بيشتغل الجهاز المناعي والتطعيم؟');
  assert.equal(result.specialist.id, 'specialist_health');
  assert.equal(result.source, 'science');
  assert.match(result.answer, /المناعة/);
  assert.match(result.answer, /علوم شاهين|منهج مدرسة شاهين/);
  assert.ok(result.citations.some((c) => c.kind === 'science'), 'the lesson is cited');
  assert.ok(!VENDOR.test(result.answer));
});

test('no engine: a store question is answered with the store’s real products, and an order is handed over by name', async () => {
  const price = await runLocal('بكام عطر العود عندكم؟');
  assert.ok(['store', 'agent', 'gap', 'library'].includes(price.result.source), price.result.source);
  assert.ok(!VENDOR.test(price.result.answer));

  const { result } = await runLocal('عايز أطلب 100 زجاجة جملة');
  assert.equal(result.source, 'agent', 'a service request is not answered with a lesson');
  assert.match(result.answer, /مساعد شام/, 'the hand-over is named');
  assert.ok(result.actions.some((a) => a.type === 'hand_over' && a.to === 'sham' || a.type === 'open_chat'), 'the visitor gets the way to him');
  assert.equal(result.ok, true, 'an honest hand-over is not a failure');
});

test('no engine: a question with no solid fact is an honest gap, named and recorded for the school', async () => {
  const { result, gaps } = await runLocal('إزاي أصنع تلسكوب في البيت؟');
  assert.equal(result.ok, false);
  assert.equal(result.source, 'gap');
  assert.equal(result.ai, false);
  assert.match(result.answer, /التخمين ممنوع|هيذاكره/);
  assert.match(result.answer, new RegExp(result.specialist.nameAr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the gap names the specialist');
  if (result.recorded) {
    assert.equal(gaps.length, 1, 'the gap is written down once');
    assert.equal(gaps[0].question, 'إزاي أصنع تلسكوب في البيت؟');
    assert.match(gaps[0].reason || '', /specialists:/);
  }
});

test('no engine: an English question is answered in English — an Arabic-only lesson is an honest gap, never a guess', async () => {
  const { result } = await runLocal('What is encryption and how does it protect data?', 'en');
  assert.equal(result.lang, 'en');
  assert.ok(!ARABIC.test(result.answer), `no Arabic in an English answer: ${result.answer.slice(0, 120)}`);
  assert.ok(!VENDOR.test(result.answer));
  if (result.source === 'gap') assert.match(result.answer, /guessing is forbidden/);
});

test('no engine: the visitor’s own specialist wins over routing, and a section suggests its consultant', async () => {
  const { result } = await runLocal('احسب مقادير زجاجة 50 مل بتركيز 20%', 'ar', 'home');
  assert.ok(SITE_SECTIONS.some((s) => s.id === 'home'));
  assert.equal(result.section, 'home');
  const forced = await runSpecialistAgent(
    validateConsultInput({ question: 'إيه هو الأمبروكسان؟', specialist: 'specialist_culture' }),
    { repo: fakeRepo({ gaps: [], engines: [], enabled: true }), env: {}, fetch: offline, library: async () => EMPTY_LIBRARY, research: async () => undefined },
  );
  assert.equal(forced.specialist.id, 'specialist_culture', 'the visitor’s choice is respected');
});

/* ── 4. بمحرك: الوكيل بيشتغل بأدواته ──────────────────────────────────────────────────────────── */
const ENGINE_ENV = { SHAM_LLM_BASE_URL: 'https://models.test/v1', SHAM_LLM_API_KEY: 'test-key', SHAM_LLM_MODEL: 'test-model' };
const engineFetch = (replies: string[]) => {
  const calls: string[] = [];
  const fetcher = (async (_url: unknown, init?: RequestInit) => {
    calls.push(String(init?.body || ''));
    const text = replies[Math.min(calls.length - 1, replies.length - 1)];
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
};

async function runWithEngine(question: string, replies: string[]) {
  const gaps: { question: string; source: string; reason?: string }[] = [];
  const learned: { question: string; answer: string }[] = [];
  const { fetcher, calls } = engineFetch(replies);
  const result = await runSpecialistAgent(
    validateConsultInput({ question }),
    {
      repo: fakeRepo({ gaps, engines: ['self_hosted'], enabled: true }), memory: fakeMemory(learned),
      env: ENGINE_ENV, fetch: fetcher, library: async () => EMPTY_LIBRARY, research: async () => undefined,
    },
  );
  return { result, gaps, learned, calls };
}

test('an engine: the agent asks for a tool, reads its observation, answers from it and saves the answer in memory', async () => {
  const { result, learned, calls } = await runWithEngine('ايه هو الأمبروكسان؟', [
    'TOOL material_card {"name":"أمبروكسان"}',
    'ANSWER: الأمبروكسان مثبت عنبري جاف بيدي ثبات للعطر، ونسبته المعتادة مكتوبة في موسوعة المواد الخام في شام.',
  ]);
  assert.equal(result.ai, true, 'the agent really answered');
  assert.equal(result.source, 'material', 'the answer carries the source of the fact it stands on');
  assert.match(result.answer, /مثبت عنبري/);
  assert.match(result.answer, /موسوعة المواد الخام/, 'the source line is written on the answer');
  assert.ok(result.tools.some((t) => t.tool === 'material_card' && t.ok), 'the tool the agent asked for ran');
  assert.ok(calls.length >= 2, 'the observation went back to the agent');
  assert.ok(calls[1].includes('أمبروكسان'), 'the second turn carries the tool’s facts');
  assert.equal(learned.length, 1, 'a good answer is kept — next time no engine is needed');
  assert.ok(!VENDOR.test(result.answer));
});

test('an engine: an invented price, a vendor name or a too-short answer is refused — the tools answer instead', async () => {
  const price = await runWithEngine('ايه هو الأمبروكسان؟', ['ANSWER: الأمبروكسان سعره 4500 جنيه للكيلو وهو أرخص مادة في العالم.']);
  assert.equal(price.result.ai, false, 'an ungrounded price is refused');
  assert.ok(!/4500/.test(price.result.answer), 'the invented number never reaches the visitor');

  const vendor = await runWithEngine('ايه هو الأمبروكسان؟', ['ANSWER: according to Gemini the material is a fixative used in perfumery.']);
  assert.equal(vendor.result.ai, false, 'a vendor name is refused');
  assert.ok(!VENDOR.test(vendor.result.answer));

  const short = await runWithEngine('ايه هو الأمبروكسان؟', ['ANSWER: لا أعرف.']);
  assert.equal(short.result.ai, false, 'an empty answer is refused');
  assert.ok(short.result.answer.length > 20, 'the visitor still gets a real answer or an honest gap');
});

test('an engine: when every engine fails, the agent falls back to its own tools without an error', async () => {
  const gaps: { question: string; source: string; reason?: string }[] = [];
  const failing = (async () => { throw new Error('upstream down'); }) as unknown as typeof fetch;
  const result = await runSpecialistAgent(
    validateConsultInput({ question: 'احسب مقادير زجاجة 50 مل بتركيز 20%' }),
    { repo: fakeRepo({ gaps, engines: ['self_hosted'], enabled: true }), env: ENGINE_ENV, fetch: failing, library: async () => EMPTY_LIBRARY, research: async () => undefined },
  );
  assert.equal(result.ai, false);
  assert.equal(result.source, 'calculator', 'the calculators answer even with the engines down');
  assert.match(result.answer, /10\s*مل/);
});

test('the owner’s switch: with the platforms closed, no engine is called at all', async () => {
  const gaps: { question: string; source: string; reason?: string }[] = [];
  const { fetcher, calls } = engineFetch(['ANSWER: رد من محرك خارجي.']);
  const result = await runSpecialistAgent(
    validateConsultInput({ question: 'احسب مقادير زجاجة 50 مل بتركيز 20%' }),
    { repo: fakeRepo({ gaps, engines: ['self_hosted'], enabled: true }), env: { ...ENGINE_ENV, SHAM_AI_PLATFORMS: 'off' }, fetch: fetcher, library: async () => EMPTY_LIBRARY, research: async () => undefined },
  );
  assert.equal(calls.length, 0, 'nothing left the server');
  assert.equal(result.ai, false);
  assert.equal(result.source, 'calculator');
});
