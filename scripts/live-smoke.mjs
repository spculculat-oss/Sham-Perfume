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
  { title: 'Fast · EDP vs EDT (ar)', path: '/api/chat', table: true, body: { model: 'fast', language: 'ar', message: 'إيه الفرق بين EDP و EDT؟' } },
  { title: 'Deep · cloudy perfume (en)', path: '/api/chat', body: { model: 'deep', language: 'en', message: 'My perfume turned cloudy after I added alcohol. Why, and how do I fix it?' } },
  { title: 'Visual aids · oud (ar)', path: '/api/chat', media: true, body: { model: 'auto', language: 'ar', message: 'العود الخام شكله إيه وبيتقطر إزاي؟ وريني صور وفيديو.' } },
  { title: 'Map · perfume cities (ar)', path: '/api/chat', places: true, body: { model: 'auto', language: 'ar', message: 'إيه أشهر مدن العطور في العالم؟ وريني أماكنها على الخريطة.' } },
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

async function post(path, body, visitor = visitorId) {
  const started = Date.now();
  try {
    const res = await fetch(`${SITE}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, 'x-sham-visitor': visitor }, body: JSON.stringify(body),
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
    // A saved answer from «ذاكرة شاهين» needs no engine, so it may still answer while the council is off.
    const fromMemory = status === 200 && /ذاكرة شاهين|Shaheen's memory/i.test(reply);
    if (!fromMemory && !(status === 503 && data.code === 'COUNCIL_UNAVAILABLE')) problems.push(`expected 503 COUNCIL_UNAVAILABLE while the council is off, got ${status} ${data.code || ''}`);
  } else {
    if (status !== 200) problems.push(`HTTP ${status} ${data.code || data.error || ''}`);
    if (status === 200 && !reply.trim()) problems.push('empty reply');
  }
  if (VENDORS.test(reply)) problems.push(`vendor name in reply: «${reply.match(VENDORS)[0]}»`);
  if (data.engine && typeof data.engine === 'object' && VENDORS.test(JSON.stringify(data.engine))) problems.push('vendor name in engine field');
  if (c.path === '/api/chat' && status === 200 && data.mode !== c.body.model) problems.push(`mode ${data.mode} ≠ ${c.body.model}`);
  if (c.identity && status === 200 && !/شاهين|شام|Shahin|Shaheen|Sham/i.test(reply)) problems.push('identity answer does not present itself as Shahin/Sham');
  const notes = [];
  if (!c.identity && c.path === '/api/chat' && /الخبير شاهين|شاهين|Shahin|Shaheen|Al-Khabeer/i.test(reply.slice(0, 140))) notes.push('starts by introducing itself');
  // Visual aids: topics in a sham-media block, never links written by the model.
  if (c.path === '/api/chat' && /!\[[^\]]*\]\(|https?:\/\/\S+\.(jpe?g|png|webp|gif)|youtube\.com\/watch|youtu\.be\/|maps\.(google|apple)\.|openstreetmap\.org\/[?#]/i.test(reply)) problems.push('the model wrote an image/video/map link itself');
  if (c.media && status === 200 && !/```sham-media/.test(reply)) notes.push('no sham-media block for a visual question');
  if (c.places && status === 200 && !/```sham-media[\s\S]*?"places"/.test(reply)) notes.push('no places in sham-media for a map question');
  if (c.table && status === 200 && !/^\s*\|.+\|\s*$/m.test(reply)) notes.push('comparison without a table');
  const ok = problems.length === 0;
  if (!ok) failures++;
  const head = `${ok ? 'OK' : 'FAIL'} · HTTP ${status} · ${(ms / 1000).toFixed(1)}s${data.mode ? ` · mode=${data.mode}` : ''}${engine ? ` · engine=${engine}` : ''}`;
  annotate(!ok ? 'error' : notes.length ? 'warning' : 'notice', `${i + 1}. ${c.title}`, `${head}${problems.length ? `\nPROBLEMS: ${problems.join('; ')}` : ''}${notes.length ? `\nNOTE: ${notes.join('; ')}` : ''}\nQ: ${c.body.message}\nA: ${clip(reply || JSON.stringify(data))}`);
  summary.push(`| ${i + 1} | ${c.title} | ${status} | ${(ms / 1000).toFixed(1)}s | ${ok ? '✅' : '❌ ' + problems.join('; ').replace(/\|/g, '/')} |`);
  details.push(`### ${i + 1}. ${c.title}\n**Q:** ${c.body.message}\n\n${reply ? reply : '`' + JSON.stringify(data) + '`'}\n`);
}

// ---------- capacity (many visitors at once) ----------
summary.push('', '### Capacity', '', '| Check | Result |', '|---|---|');
const capacity = (title, ok, message, warnOnly = false) => {
  if (!ok && !warnOnly) failures++;
  annotate(ok ? 'notice' : warnOnly ? 'warning' : 'error', `Capacity · ${title}`, message);
  summary.push(`| ${title} | ${ok ? '✅' : warnOnly ? '⚠️' : '❌'} ${message.replace(/\|/g, '/').replace(/\n/g, ' ')} |`);
};
{
  // The GitHub Pages site calls the API cross-origin: it must be allowed to send the visitor id and read Retry-After.
  const pages = 'https://spculculat-oss.github.io';
  const pre = await fetch(`${SITE}/api/chat`, { method: 'OPTIONS', headers: { origin: pages, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-sham-visitor' } }).catch(() => null);
  const allow = pre?.headers.get('access-control-allow-headers') || '';
  const expose = (await fetch(`${SITE}/api/models`, { headers: { origin: pages } }).catch(() => null))?.headers.get('access-control-expose-headers') || '';
  capacity('CORS for Pages', /x-sham-visitor/i.test(allow) && /retry-after/i.test(expose), `allow-headers: ${allow || '—'} · expose-headers: ${expose || '—'}`);

  // 12 different visitors behind ONE IP (this runner), all asking the same opening question at once:
  // none may be refused (old per-IP limit was 10/min), and repeats come from the answer cache.
  await sleep(GAP_MS);
  const question = { model: 'fast', language: 'ar', message: 'إيه الفرق بين EDP و EDT؟' };
  const crowd = await Promise.all(Array.from({ length: 12 }, (_, n) => post('/api/chat', question, `${visitorId}-crowd-${n}`)));
  const statuses = crowd.map((r) => r.status);
  const answered = crowd.filter((r) => r.status === 200 && typeof r.data.reply === 'string' && r.data.reply.trim());
  const times = crowd.map((r) => r.ms).sort((x, y) => x - y);
  capacity('12 visitors · one IP', answered.length === crowd.length, `HTTP ${statuses.join(',')} · median ${(times[6] / 1000).toFixed(1)}s · max ${(times[11] / 1000).toFixed(1)}s${crowd.some((r) => r.status === 503) ? ` · busy: ${crowd.find((r) => r.status === 503).data.code}` : ''}`);
  const distinct = new Set(answered.map((r) => r.data.reply)).size;
  const again = await post('/api/chat', question, `${visitorId}-repeat`);
  capacity('Answer cache', again.status === 200 && again.ms < 2500 && distinct <= 2,
    `same opening question: ${distinct} distinct repl${distinct === 1 ? 'y' : 'ies'} for 12 visitors · a later visitor got HTTP ${again.status} in ${(again.ms / 1000).toFixed(1)}s`, true);
}

const out = [...summary, '', ...details].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + '\n');
} else console.log(out);
console.log(`\n${failures ? `${failures} check(s) failed` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
