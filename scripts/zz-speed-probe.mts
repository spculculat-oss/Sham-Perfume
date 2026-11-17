// Temporary: which Gemini models answer fast with this key right now. Prints models, statuses, timings only.
import { failureDetail, geminiThinking, rankGeminiModels } from '../server/core/engines';
const key = process.env.GEMINI_API_KEY!.trim();
const base = 'https://generativelanguage.googleapis.com/v1beta';
const list = await (await fetch(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })).json() as { models: { name: string; supportedGenerationMethods: string[] }[] };
const ranked = rankGeminiModels(list.models);
console.log(`ranked: ${ranked.slice(0, 14).join(' ')}`);
const pick = [...new Set(['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', ...ranked.slice(0, 8)])].filter((m) => ranked.includes(m) || /2\.5/.test(m));
const ask = async (model: string, thinking: Record<string, unknown>, search: boolean) => {
  const body = { systemInstruction: { parts: [{ text: 'رد بالمصري باختصار.' }] }, contents: [{ role: 'user', parts: [{ text: 'إيه الفرق بين القهوة التركي والإسبريسو؟' }] }], generationConfig: { temperature: 0.6, ...thinking }, ...(search ? { tools: [{ google_search: {} }] } : {}) };
  const start = Date.now();
  try {
    const res = await fetch(`${base}/models/${model}:streamGenerateContent?alt=sse`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const head = Date.now() - start;
    if (!res.ok) return `${res.status} ${failureDetail(await res.text()).slice(0, 160)} (${head}ms)`;
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let first = 0; let text = '';
    for (;;) { const { value, done } = await reader.read(); if (done) break; const s = dec.decode(value); if (!first && /"text"/.test(s)) first = Date.now() - start; text += s; }
    return `ok head ${head}ms · first text ${first}ms · end ${Date.now() - start}ms`;
  } catch (e) { return `threw ${(e as Error).name} after ${Date.now() - start}ms`; }
};
for (const model of pick) {
  const t = geminiThinking(model, 1500);
  console.log(`${model} [${JSON.stringify((t as { thinkingConfig?: unknown }).thinkingConfig || {})}]: ${await ask(model, t, false)}`);
  if (/flash-latest|2\.5-flash$/.test(model)) {
    for (const level of ['minimal', 'low']) if (/latest|gemini-3/.test(model)) console.log(`  ${model} thinking=${level}: ${await ask(model, { maxOutputTokens: 3500, thinkingConfig: { thinkingLevel: level } }, false)}`);
    console.log(`  ${model} +search: ${await ask(model, t, true)}`);
  }
}
