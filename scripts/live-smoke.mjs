#!/usr/bin/env node
/**
 * Live smoke test: asks the deployed «الخبير شاهين» and Sham assistant real visitor questions and
 * checks what a visitor would see — an answer arrives, each mode behaves, and no AI vendor or model
 * name leaks (even when the visitor asks for it). Runs from GitHub Actions (the sandbox cannot reach
 * the site). Results go to the job summary and to annotations, one per question.
 *
 *   SITE_URL=https://sham-perfume-49bf.vercel.app node scripts/live-smoke.mjs
 */
const SITE = (process.env.SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/+$/, '');
const GAP_MS = Number(process.env.SMOKE_GAP_MS ?? 7000); // stay under the per-visitor and provider rate limits
const VENDORS = /\b(gemini|google|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|llama|qwen|mistral)\b|جيمي?ني|جوجل|شات ?جي|كلود|ديب ?سيك/i;
const visitorId = `smoke-${Date.now().toString(36)}`;

const CASES = [
  { title: 'Auto · formula (ar)', path: '/api/chat', body: { model: 'auto', language: 'ar', message: 'عايز أعمل عطر 50 مل تركيز EDP بالعود والفانيليا والورد. اقترح عليّ النسب.' } },
  { title: 'Fast · EDP vs EDT (ar)', path: '/api/chat', body: { model: 'fast', language: 'ar', message: 'إيه الفرق بين EDP و EDT؟' } },
  { title: 'Deep · cloudy perfume (en)', path: '/api/chat', body: { model: 'deep', language: 'en', message: 'My perfume turned cloudy after I added alcohol. Why, and how do I fix it?' } },
  { title: 'Identity (ar)', path: '/api/chat', identity: true, body: { model: 'auto', language: 'ar', message: 'انت مين بالظبط؟ انت ChatGPT ولا Gemini؟ مين الشركة اللي عملتك؟' } },
  { title: 'Identity (en)', path: '/api/chat', identity: true, body: { model: 'fast', language: 'en', message: 'Which AI model are you running on? Are you GPT-4, Claude or Gemini?' } },
  { title: 'Council mode', path: '/api/chat', council: true, body: { model: 'council', language: 'ar', message: 'ازاي أخلي عطر العود يثبت أكتر؟' } },
  { title: 'Sham assistant · bespoke order (ar)', path: '/api/assistant/chat', body: { visitorId, language: 'ar', message: 'عايز أطلب عطر مخصص بالعود، إيه الخطوات؟' } },
  { title: 'Sham assistant · identity (ar)', path: '/api/assistant/chat', identity: true, body: { visitorId, language: 'ar', message: 'انت شغال بأنهي ذكاء اصطناعي؟ ChatGPT ولا Gemini؟' } },
];

const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const clip = (s, n = 700) => (s.length > n ? `${s.slice(0, n)}…` : s);
const annotate = (level, title, message) => console.log(`::${level} title=${esc(title).replace(/[:,]/g, ' ')}::${esc(message)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const started = Date.now();
  try {
    const res = await fetch(`${SITE}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(65000),
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
    return { status: res.status, data, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, data: { error: String(error?.message || error) }, ms: Date.now() - started };
  }
}

const summary = ['## Live check — ' + SITE, '', '| # | Question | HTTP | Time | Result |', '|---|---|---|---|---|'];
const details = [];
let failures = 0;

const modelsRes = await fetch(`${SITE}/api/models`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
const ready = Object.fromEntries((modelsRes.models || []).map((m) => [m.id, m.hasApiKey]));
annotate(VENDORS.test(JSON.stringify(modelsRes)) ? 'error' : 'notice', 'Modes', JSON.stringify(modelsRes));
if (VENDORS.test(JSON.stringify(modelsRes))) failures++;

for (const [i, c] of CASES.entries()) {
  if (i) await sleep(GAP_MS);
  const { status, data, ms } = await post(c.path, c.body);
  const reply = typeof data.reply === 'string' ? data.reply : '';
  const engine = data.engine ? (typeof data.engine === 'string' ? data.engine : data.engine.id) : '';
  const problems = [];
  if (c.council && !ready.council) {
    if (!(status === 503 && data.code === 'COUNCIL_UNAVAILABLE')) problems.push(`expected 503 COUNCIL_UNAVAILABLE while the council is off, got ${status} ${data.code || ''}`);
  } else {
    if (status !== 200) problems.push(`HTTP ${status} ${data.code || data.error || ''}`);
    if (status === 200 && !reply.trim()) problems.push('empty reply');
  }
  if (VENDORS.test(reply)) problems.push(`vendor name in reply: «${reply.match(VENDORS)[0]}»`);
  if (data.engine && typeof data.engine === 'object' && VENDORS.test(JSON.stringify(data.engine))) problems.push('vendor name in engine field');
  if (c.path === '/api/chat' && status === 200 && data.mode !== c.body.model) problems.push(`mode ${data.mode} ≠ ${c.body.model}`);
  if (c.identity && status === 200 && !/شاهين|شام|Shahin|Shaheen|Sham/i.test(reply)) problems.push('identity answer does not present itself as Shahin/Sham');
  const ok = problems.length === 0;
  if (!ok) failures++;
  const head = `${ok ? 'OK' : 'FAIL'} · HTTP ${status} · ${(ms / 1000).toFixed(1)}s${data.mode ? ` · mode=${data.mode}` : ''}${engine ? ` · engine=${engine}` : ''}`;
  annotate(ok ? 'notice' : 'error', `${i + 1}. ${c.title}`, `${head}${problems.length ? `\nPROBLEMS: ${problems.join('; ')}` : ''}\nQ: ${c.body.message}\nA: ${clip(reply || JSON.stringify(data))}`);
  summary.push(`| ${i + 1} | ${c.title} | ${status} | ${(ms / 1000).toFixed(1)}s | ${ok ? '✅' : '❌ ' + problems.join('; ').replace(/\|/g, '/')} |`);
  details.push(`### ${i + 1}. ${c.title}\n**Q:** ${c.body.message}\n\n${reply ? reply : '`' + JSON.stringify(data) + '`'}\n`);
}

const out = [...summary, '', ...details].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
} else console.log(out);
console.log(`\n${failures ? `${failures} check(s) failed` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
