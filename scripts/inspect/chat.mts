/**
 * Intensive inspection of the Shaheen chat: every question in the bank is put through the real `askWorkspace`
 * under each kind of trouble a platform can have. No key and no network are needed — the platforms are played
 * by a stand-in — so this checks the chat's own behaviour (search by itself, fall back, retry, honest reason),
 * not the quality of a platform's writing. Run: npm run inspect:chat
 */
import { askWorkspace, wantsLiveInfo, ReadError } from '../../server/workspace';
import { CHAT_BANK } from './chat-bank';

type Scenario = 'healthy' | 'all_down' | 'stumble_once' | 'quota' | 'no_platform';
const SCENARIOS: Scenario[] = ['healthy', 'all_down', 'stumble_once', 'quota', 'no_platform'];

function world(scenario: Scenario) {
  let writes = 0; let searches = 0;
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = new URL(String(url instanceof Request ? url.url : url));
    if (target.hostname.endsWith('wikipedia.org')) {
      searches += 1;
      return Response.json({ query: { search: [{ title: 'نتيجة حقيقية', snippet: 'ملخص من صفحة منشورة', pageid: 7 }] } });
    }
    const body = String(init?.body || '');
    if (body.includes('google_search')) {
      searches += 1;
      return Response.json({ candidates: [{ content: { parts: [{ text: 'ملخص من البحث الحي [1].' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.org/a', title: 'مصدر' } }] } }] });
    }
    writes += 1;
    if (scenario === 'all_down') return new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 });
    if (scenario === 'quota') return new Response('{"error":{"status":"RESOURCE_EXHAUSTED","message":"quota"}}', { status: 429 });
    if (scenario === 'stumble_once' && writes === 1) return new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 });
    return Response.json({ choices: [{ message: { content: 'رد مكتوب من المنصة.' } }] });
  }) as typeof fetch;
  const env: Record<string, string> = scenario === 'no_platform' ? {} : { OPENAI_API_KEY: 'stand-in' };
  return { request, env, counts: () => ({ writes, searches }) };
}

const rows: string[] = [];
let bad = 0;
const fail = (line: string) => { bad += 1; rows.push(`  ✗ ${line}`); };

// 1) Does the chat know by itself which questions need today's web?
let guessed = 0;
for (const item of CHAT_BANK) {
  if (wantsLiveInfo(item.text) === item.live) guessed += 1;
  else fail(`[${item.topic}] «${item.text}» — ${item.live ? 'محتاج بحث حي وما اتعرفش' : 'اتبحث عنه من غير داعي'}`);
}

// 2) Every question under every kind of trouble.
const tally: Record<Scenario, { answered: number; fromSearch: number; honest: number; total: number }> = Object.fromEntries(
  SCENARIOS.map((s) => [s, { answered: 0, fromSearch: 0, honest: 0, total: 0 }])) as never;
const EXPECTED_CODE: Partial<Record<Scenario, string>> = { all_down: 'ENGINES_BUSY', quota: 'ENGINES_QUOTA', no_platform: 'NO_ENGINE' };
const quiet = console.warn; console.warn = () => {};
for (const scenario of SCENARIOS) {
  for (const item of CHAT_BANK) {
    const w = world(scenario); const t = tally[scenario]; t.total += 1;
    try {
      const out = await askWorkspace({ messages: [{ role: 'user', text: item.text }] }, { env: w.env, fetch: w.request, retryDelayMs: 0 });
      if (!out.reply.trim()) { fail(`${scenario} [${item.topic}] «${item.text}» — رد فاضي`); continue; }
      t.answered += 1;
      if (out.via === 'search') t.fromSearch += 1;
      if (item.live && !out.sources.length) fail(`${scenario} [${item.topic}] «${item.text}» — سؤال حي اترد عليه من غير مصادر`);
      if (!item.live && w.counts().searches) fail(`${scenario} [${item.topic}] «${item.text}» — بحث من غير داعي`);
    } catch (error) {
      const code = error instanceof ReadError ? error.code : 'CRASH';
      if (item.live) fail(`${scenario} [${item.topic}] «${item.text}» — سؤال حي انتهى بخطأ ${code}`);
      else if (code === EXPECTED_CODE[scenario]) t.honest += 1;
      else fail(`${scenario} [${item.topic}] «${item.text}» — خطأ ${code} بدل ${EXPECTED_CODE[scenario] || 'رد'}`);
    }
  }
}
console.warn = quiet;

const NAMES: Record<Scenario, string> = {
  healthy: 'المنصات شغالة', all_down: 'كل المنصات واقعة', stumble_once: 'منصة اتعثرت مرة', quota: 'الحصة خلصت', no_platform: 'مفيش منصة متوصلة',
};
console.log(`فحص شات شاهين — ${CHAT_BANK.length} سؤال × ${SCENARIOS.length} حالات`);
console.log(`معرفة الأسئلة اللي محتاجة بحث حي: ${guessed}/${CHAT_BANK.length}`);
for (const s of SCENARIOS) {
  const t = tally[s];
  console.log(`- ${NAMES[s]}: اترد على ${t.answered}/${t.total} (منهم ${t.fromSearch} من البحث مباشرة)، وسبب صريح لـ ${t.honest}`);
}
if (rows.length) console.log(rows.join('\n'));
console.log(bad ? `النتيجة: ${bad} ملاحظة محتاجة شغل` : 'النتيجة: كله سليم');
console.log('ملحوظة: المنصات هنا بديل تجريبي؛ جودة كتابة الرد نفسها بتتقاس على الموقع الحي بس.');
process.exit(bad ? 1 : 0);
