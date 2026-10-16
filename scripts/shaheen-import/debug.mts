// TEMP diagnostics
const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').replace(/\s+/g, ' ').slice(0, 1000);
const note = (title: string, msg: string) => console.log(`::notice title=${title}::${clean(msg)}`);
const { callEngine } = await import('../../server/core/engines.ts');
try {
  const r = await callEngine('gemini', 'Reply with JSON only.', [{ role: 'user', text: 'Return {"ok":true}' }], { env: process.env, signal: AbortSignal.timeout(60000), temperature: 0.2, maxTokens: 16000, maxChars: 200000, onFailure: (f, st, d) => note('gemini failure', `${JSON.stringify(f)} ${st} ${d}`), onModel: (m) => note('model', m) });
  note('gemini', `answered: ${String(r).slice(0, 200)}`);
} catch (e) { note('gemini error', String((e as Error).message || e)); }
