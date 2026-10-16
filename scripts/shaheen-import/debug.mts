// TEMP diagnostics
const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').replace(/\s+/g, ' ').slice(0, 1000);
const note = (title: string, msg: string) => console.log(`::notice title=${title}::${clean(msg)}`);
const { extractProduct, pageText, jsonLdNodes } = await import('./extract.ts');
for (const url of ['https://www.shamperfume.com/perfumes/rasasi/hawas-ice-freeze/', 'https://www.shamperfume.com/perfumes/kenz-de-rasasi/hawas-for-him-le-parfum/']) {
  const sm = await (await fetch('https://www.shamperfume.com/sitemap-perfumes-1.xml')).text();
  const real = url.includes('ice') ? (sm.match(/<loc>(https:\/\/www\.shamperfume\.com\/perfumes\/[^<]*hawas-ice[^<]*)<\/loc>/) || [])[1] || url : url;
  const html = await (await fetch(real, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const p = jsonLdNodes(html).find((n) => n['@type'] === 'Product') as Record<string, unknown> | undefined;
  note('desc', `${real} :: ${String(p?.description || '').slice(-600)}`);
  const t = pageText(html); const i = t.search(/Top Notes|Top:|Head Notes|Notes/i);
  note('text notes', t.slice(i - 100, i + 600));
  note('extract', JSON.stringify(extractProduct(html, real)?.notes));
}
const { callEngine } = await import('../../server/core/engines.ts');
try {
  const r = await callEngine('gemini', 'Reply with JSON only.', [{ role: 'user', text: 'Return {"ok":true}' }], { env: process.env, signal: AbortSignal.timeout(60000), temperature: 0.2, maxTokens: 16000, maxChars: 200000 });
  note('gemini', `answered: ${String(r).slice(0, 200)}`);
} catch (e) { note('gemini error', String((e as Error).message || e)); }
