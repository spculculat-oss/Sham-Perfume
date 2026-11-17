// Temporary: where does a workspace turn spend its time? Prints hosts, models, statuses and timings only.
import { askWorkspace } from '../server/workspace';
const t0 = () => Date.now();
const timed: typeof fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  const host = new URL(url).host; const model = url.match(/models\/([^:?]+)/)?.[1] || '';
  const body = typeof init?.body === 'string' ? init.body : '';
  const tag = `${host}${model ? ` ${model}` : ''}${body.includes('google_search') ? ' +search' : ''}${url.includes('stream') ? ' stream' : ''}`;
  const start = t0();
  try {
    const res = await fetch(input, init);
    const head = t0() - start;
    if (!res.body) { console.log(`  ${tag} → ${res.status} head ${head}ms`); return res; }
    let firstChunk = 0;
    const [a, b] = res.body.tee();
    (async () => { const r = b.getReader(); const { done } = await r.read(); firstChunk = t0() - start; if (!done) { while (!(await r.read()).done) { /* drain */ } } console.log(`  ${tag} → ${res.status} head ${head}ms · first chunk ${firstChunk}ms · body end ${t0() - start}ms`); })().catch(() => {});
    return new Response(a, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (error) { console.log(`  ${tag} → threw ${(error as Error).name} after ${t0() - start}ms`); throw error; }
};
const qs: [string, string][] = [['simple2', 'إيه الفرق بين الشاي الأخضر والشاي الأسود؟'], ['hello', 'أهلاً، إزيك؟'], ['simple', 'إيه الفرق بين القهوة التركي والإسبريسو؟'], ['code', 'اكتبلي دالة بايثون بتعكس كلمة'], ['news', 'إيه أخبار مصر النهارده؟'], ['fact', 'مين رئيس وزراء الهند؟']];
const configured = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY'].filter((k) => process.env[k]?.trim());
console.log(`configured: ${configured.join(', ')}`);
for (const [name, q] of qs) {
  const start = t0(); let first = 0;
  console.log(`## ${name}`);
  try {
    const out = await askWorkspace({ messages: [{ role: 'user', text: q }], language: 'ar' } as never, { env: process.env, fetch: timed, onEvent: (e: { type: string }) => { if (e.type === 'delta' && !first) first = t0() - start; } } as never);
    console.log(`=> ${name}: first word ${first}ms · total ${t0() - start}ms · ${out.reply.length} chars`);
  } catch (error) { console.log(`=> ${name}: failed ${(error as Error).message} after ${t0() - start}ms`); }
}
