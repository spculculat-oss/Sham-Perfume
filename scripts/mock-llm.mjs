#!/usr/bin/env node
/**
 * Development-only mock of an OpenAI-compatible model server (POST /v1/chat/completions, with or
 * without `stream: true`). It lets you see the advisory council work end-to-end with zero API keys:
 *
 *   node scripts/mock-llm.mjs            # listens on 127.0.0.1:11999
 *   SHAM_LLM_BASE_URL=http://127.0.0.1:11999/v1 npm run dev
 *
 * then add council seats on the "self_hosted" engine with models demo-a / demo-b / demo-c.
 * Answers are canned and clearly NOT real model output. Never point production at this.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_LLM_PORT) || 11999;
const HOST = process.env.MOCK_LLM_HOST || '127.0.0.1';
const FAIL = new Set((process.env.MOCK_LLM_FAIL_MODELS || '').split(',').filter(Boolean));

const lensOf = (system) => (system.match(/lens: ([^.\n]+)/) || [])[1] || '';
const lastUser = (messages) => [...messages].reverse().find((m) => m.role === 'user')?.content || '';
const question = (text) => (text.match(/VISITOR QUESTION:\n([\s\S]*?)\n\n/) || [, text])[1].trim().slice(0, 140);

function answer(model, messages) {
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const user = lastUser(messages);
  const ar = /in Arabic/i.test(system);
  const lens = lensOf(system);
  if (/PEER REVIEW/.test(system)) {
    return ar
      ? `نقد: الرأي ${/Position A/.test(user) ? 'A' : 'B'} أغفل اختبار الثبات على الجلد، وأي سعر أو مدة توصيل لازم يتأكد من فريق شام لأنه مش في السياق.\nRevised position: أتفق على البدء بعينة صغيرة موثقة النِسب، مع إضافة اختبار حساسية قبل الاستخدام الواسع.`
      : `Critique: position ${/Position A/.test(user) ? 'A' : 'B'} skips a skin-tolerance test, and any price or delivery time must be confirmed by the Sham team.\nRevised position: agree on a small documented test batch, plus a patch test before wider use.`;
  }
  if (/You chair/.test(system)) {
    return ar
      ? `الخلاصة\nابدأ بتجربة صغيرة محسوبة بدل دفعة كبيرة، وثبّت النِسب قبل أي إنتاج.\n\nالتوصية\n1. حضّر عينة 10 مل بتركيز 15–20% زيت عطري.\n2. سيبها تتعتّق من أسبوعين لأربعة في مكان مظلم وبارد.\n3. جرّبها على الجلد وسجّل الثبات والفوحان بعد 1 و4 و8 ساعات.\n\nتنبيهات\n• اعمل اختبار حساسية على مساحة صغيرة قبل الاستخدام.\n• أي سعر أو مدة تنفيذ لازم يتأكدوا من فريق شام.\n\nنقطة خلاف\nالمستشار التجاري فضّل تركيزاً أقل لتقليل التكلفة، ومراجع السلامة فضّل البدء بالأقل كمان؛ الخبير التقني يرى 18% أفضل للثبات.\n\nالخطوة الجاية مع شام\nلو حابب نركّبها لك، اطلب «عطر مخصص» من الاستمارة تحت.`
      : `Bottom line\nStart with a small measured test batch instead of a large run, and lock the percentages first.\n\nRecommendation\n1. Make a 10 ml sample at 15–20% fragrance oil.\n2. Macerate 2–4 weeks somewhere cool and dark.\n3. Test on skin and log longevity at 1, 4 and 8 hours.\n\nCaveats\n• Patch-test before regular use.\n• Prices and lead times must be confirmed by the Sham team.\n\nWhere advisors differed\nThe commercial advisor preferred a lower concentration for cost; the formulation expert prefers 18% for longevity.\n\nNext step with Sham\nRequest a bespoke perfume with the form below.`;
  }
  if (/seat [A-Z] on the advisory council/.test(system)) {
    const q = question(user);
    const byLens = ar ? {
      perfumery: `التوصية: تركيز 18% زيت عطري مناسب لـ«${q}» مع تعتيق 3 أسابيع. السبب: توازن بين الثبات والفوحان. غير متأكد من نوع المواد اللي عند الزائر.`,
      cost: 'التوصية: ابدأ بـ 12–15% لتقليل التكلفة، وجرّب على 10 مل قبل أي كمية. الأسعار الفعلية لازم تتأكد من فريق شام.',
      safety: 'التوصية: لا تتجاوز حدود الاستخدام الآمنة لكل مادة، واعمل اختبار حساسية على الجلد، وخزّن العطر بعيداً عن الضوء والحرارة.',
      goal: 'التوصية: افهم الأول الزائر عايز عطر يومي ولا للمناسبات؛ الأبسط ليه عينة صغيرة يجربها أسبوع قبل ما يقرر.',
    } : {
      perfumery: `Recommendation: 18% fragrance oil suits “${q}”, macerated 3 weeks, for a balance of longevity and projection.`,
      cost: 'Recommendation: start at 12–15% to keep cost down and test 10 ml first. Actual prices must be confirmed by Sham.',
      safety: 'Recommendation: respect safe usage limits per material, patch-test, and store away from light and heat.',
      goal: 'Recommendation: first clarify daily vs. occasion wear; a small sample to live with for a week is the simplest path.',
    };
    const key = /formulation/.test(lens) ? 'perfumery' : /cost/.test(lens) ? 'cost' : /safety/.test(lens) ? 'safety' : 'goal';
    return byLens[key];
  }
  // «الخبير شاهين» (perfume-design chat): Markdown + one transferable formula block.
  if (/أنت شاهين/.test(system)) {
    if (/Health check/.test(system)) return 'OK';
    const formula = { title: 'عود وورد — مقترح تجريبي', author: 'شاهين — مقترح تجريبي', concentrationPercent: 20, concentrationType: 'edp',
      bottleVolumeMl: 50, alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0, macerationDays: 30, summary: 'مقترح يحتاج مراجعة السلامة',
      pyramidNotes: [
        { id: 'note-1', nameAr: 'برغموت', nameEn: 'Bergamot', category: 'top', percentageOfOil: 20 },
        { id: 'note-2', nameAr: 'ورد طائفي', nameEn: 'Taif rose', category: 'heart', percentageOfOil: 35 },
        { id: 'note-3', nameAr: 'عود', nameEn: 'Oud', category: 'base', percentageOfOil: 45 },
      ] };
    return `### مقترح مبدئي (نموذج تجريبي للتطوير — ليس رداً حقيقياً)\nسؤالك: «${lastUser(messages).slice(0, 80)}»\n\n**الحجم:** 50 مل بتركيز **20%** (أو دي بارفان).\n\n| الطبقة | المادة | النسبة من الزيت |\n|---|---|---|\n| علوية | برغموت | 20% |\n| قلب | ورد طائفي | 35% |\n| قاعدة | عود | 45% |\n\n- زيت عطري: 10 مل، وكحول 96%: 40 مل.\n- التعتيق: *30 يوماً* في مكان بارد ومظلم.\n\n> المقترح تجريبي ويحتاج مراجعة السلامة واختبار حساسية.\n\n\`\`\`sham-formula\n${JSON.stringify(formula)}\n\`\`\``;
  }
  // Normal single-engine answer: rephrase Sham's grounded draft.
  const draft = (system.match(/SAFE DRAFT[^\n]*\n([\s\S]*)$/) || [, ''])[1].trim();
  return draft || (ar ? 'تمام، أقدر أساعدك في خدمات شام.' : 'Sure, I can help with Sham services.');
}

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) { res.writeHead(404).end(); return; }
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', async () => {
    let body;
    try { body = JSON.parse(raw); } catch { res.writeHead(400).end(); return; }
    if (FAIL.has(body.model)) { res.writeHead(503).end(); return; }
    const text = answer(body.model, body.messages || []);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    if (!body.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const piece of text.match(/\S+\s*/g) || [text]) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 25));
    }
    res.end('data: [DONE]\n\n');
  });
}).listen(PORT, HOST, () => console.log(`mock LLM (dev only) on http://${HOST}:${PORT}/v1`));
