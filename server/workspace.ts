import { REAL_PHOTO_INSTRUCTION, realPhotoReply, wantsRealPhoto } from '../src/utils/realPhotos';
import { CONTINUITY_INSTRUCTION, contextualMessage, conversationFocus, isContextFollowUp } from '../src/utils/conversationContext';
/**
 * «مساحة شاهين»: Shaheen as a general assistant — any subject, not perfume only.
 *   /api/workspace/status   what is open right now (no vendor names: visitors never see them)
 *   /api/workspace/ask      a conversation (chat, a multi-step plan, a summary), with the visitor's files as context
 *                           and, on request, live web results with their links
 *   /api/workspace/search   web search: the AI platform's own search when it has one, else the free encyclopedia API
 *   /api/workspace/read     a public page or PDF read as text (SSRF-guarded: public addresses only, size and time caps)
 *   /api/workspace/image    an image made or edited by the AI platform (503 NO_IMAGE_ENGINE → an honest unavailable message; no external generator fallback)
 *   /api/workspace/owner/*  the owner's own Notion and Slack (Bearer SHAM_ADMIN_TOKEN; keys stay on the server)
 * Code runs, files, documents, image editing and reading aloud happen in the visitor's browser (src/workspace):
 * nothing of the visitor's files is stored here.
 */
import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { callEngine, engineStatuses, GEMINI_DEFAULT_MODEL, type EngineTurn } from './core/engines';
import { RateLimiter, clientKey } from './core/rateLimit';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';

type Env = Record<string, string | undefined>;
type Lookup = (host: string) => Promise<string[]>;
export interface WorkspaceOptions { env?: Env; fetch?: typeof fetch; lookup?: Lookup }

/** The AI platforms a workspace turn may use, best first (live search has its own route). */
const ORDER = ['gemini', 'openai', 'claude', 'deepseek', 'openrouter', 'self_hosted'] as const;
export const configuredEngines = (env: Env) => {
  const statuses = engineStatuses(env);
  return ORDER.filter((id) => statuses.find((s) => s.id === id)?.configured);
};

const MAX_CONTEXT = 60_000;
const MAX_READ = 40_000;
const LANGS = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
const languageOf = (value: unknown): SupportedLanguage => (typeof value === 'string' && LANGS.has(value as SupportedLanguage) ? value as SupportedLanguage : 'ar');

/** Who Shaheen is in the workspace: a general assistant (perfume is his deepest specialty, not his limit). */
export function workspaceInstruction(language: SupportedLanguage, task: 'chat' | 'plan' | 'summarize' = 'chat'): string {
  const name = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'العربية';
  const base = `${CONTINUITY_INSTRUCTION}\n${REAL_PHOTO_INSTRUCTION}\nأنت «شاهين»، مساعد ذكاء اصطناعي شامل داخل منصة «شام». بتساعد في أي موضوع: كتابة، ترجمة، دراسة وشرح، برمجة ومواقع، تحليل بيانات وجداول، أفكار وتسويق، شغل ومستندات، أسئلة عامة — والعطور تخصصك العميق مش حدودك.
هويتك «شاهين» بس: ما تذكرش اسم أي نموذج أو شركة ذكاء اصطناعي، ولو اتسألت قول إنك مساعد منصة شام والتفاصيل التقنية مش متاحة.
رد بلغة المستخدم (${name}). لو بيكتب عربي مصري رد بالمصري العامي الواضح؛ ولو لهجة تانية رد بيها؛ ولو فصحى رد بفصحى بسيطة. افهم السياق والكلام اللي فات، وادخل في الإجابة على طول من غير مقدمات.
كن صادق: ما تخترعش مصادر أو أرقام أو روابط أو أحداث، وقول «مش متأكد» لما الدليل مش كفاية. ما تدّعيش إنك شغّلت كود أو فتحت ملف أو موقع إلا لو نتيجته موجودة قدامك في الرسالة.
لو المستخدم بعت ملفات أو صفحات (هتلاقيها بين علامات «ملف:»)، اعتمد عليها واذكر اسم الملف لما تستشهد بيه.
لو في نتايج بحث ويب مرقّمة، استشهد بيها برقمها [1] [2] ومتستخدمش غيرها كمصدر.
البرمجة: اكتب الكود كامل وشغّال جوّه سياج بلغته (\`\`\`python، \`\`\`javascript، \`\`\`html…). موقع أو صفحة = ملف HTML واحد كامل فيه الـ CSS والـ JavaScript جوّاه في سياج \`\`\`html، علشان المستخدم يشوفه «معاينة حية» على طول. كود بايثون لازم يشتغل في المتصفح (مكتبات بايثون القياسية، وnumpy وpandas وmatplotlib مسموحين) ويطبع نتيجته بـ print.
المستندات: لو طلب مستند أو تقرير أو عرض، اكتبه Markdown منظم (عنوان بـ #، أقسام بـ ##، نقاط، وجداول Markdown للأرقام) — الموقع بيحوّله Word أو Excel أو PowerPoint أو PDF بضغطة. للعرض التقديمي: كل شريحة قسم ## بعنوانها ونقاط قصيرة.
الصور: لو طلب رسمة أو صورة مولدة (وليس صورة حقيقية أو أرشيفية)، اكتب في الآخر سياج \`\`\`sham-image فيه وصف إنجليزي دقيق للصورة في سطر واحد (الموقع بيرسمها).
الفيديو المتحرك: الموقع يدعم تصدير فيديو قصير محلياً من صورة بتقريب وتحريك الكاميرا بلا صوت عبر زر «عمل فيديو متحرك» تحت الصورة. ده مش توليد فيديو بالذكاء الاصطناعي ولا تحريك أشخاص أو أشياء داخل المشهد؛ وضّح الفرق بصراحة، ولا تدّعي إنشاء فيديو قبل ضغط الزر ونجاح التسجيل. لو طلب فيديو متحرك، جهّز صورة أساسية بوصف داخل سياج sham-video بدلاً من رفض كل الحركة أو توجيهه لمواقع أخرى. تحريك صورة موجودة يتم محلياً. صيغة الفيديو حسب المتصفح WebM أو MP4، ولا تدّعي دعم GIF أو MP4 تحديداً قبل التحقق.
توقيع الصور المضاف بواسطة الموقع هو sharin ai فقط (توقيع شاهين). لا تطلب كتابة اسم المزود على الصورة ولا تختلق مصدرها، ولا تمح أو تخفِ علامة منشأ أو حقوق مدمجة أصلاً. التوقيع علامة شام وليس إثباتاً أن نموذجاً خاصاً بشام ولّد الصورة.
ممنوع: المساعدة في أذى أو اختراق أو احتيال أو محتوى جنسي لقاصرين أو سلاح؛ ونصايح طبية أو قانونية أو مالية خطيرة من غير ما توجّه لمختص.`;
  if (task === 'plan') {
    return `${base}
مهمتك دلوقتي: تقسّم طلب المستخدم لخطوات تنفّذها أدوات الموقع. رد بـ JSON بس (من غير أي كلام قبله أو بعده) بالشكل:
{"goal":"الهدف باختصار","steps":[{"tool":"search","input":"..."},{"tool":"ask","input":"..."}]}
الأدوات: search (بحث ويب؛ input = عبارة البحث)، read (قراءة صفحة أو PDF؛ input = الرابط)، ask (تفكير/كتابة/تلخيص؛ input = المطلوب، وتقدر تشير لنتيجة خطوة قبلها بـ {{1}} أو {{2}})، image (رسم صورة؛ input = وصف إنجليزي)، python (تشغيل كود بايثون؛ input = الكود كامل ويطبع بـ print)، document (مستند؛ input = "docx" أو "xlsx" أو "pptx" أو "pdf" + ":" + المحتوى أو {{n}})، save (حفظ نتيجة كملف في ملفات المستخدم؛ input = "اسم-الملف.md:" + المحتوى أو {{n}}).
من خطوة لـ 8 خطوات بالكتير، والخطوة الأخيرة غالباً ask بتجمّع النتيجة النهائية للمستخدم.`;
  }
  if (task === 'summarize') return `${base}\nمهمتك دلوقتي: لخّص المحتوى اللي جاي بوضوح: الفكرة الأساسية في سطرين، وبعدين أهم النقاط، وأي أرقام أو تواريخ مهمة. لو المستخدم طلب حاجة معينة من المحتوى، ركّز عليها.`;
  return base;
}

// ── Safe reading of public pages ────────────────────────────────────────────────────────────────────────────
/** A private, loopback, link-local or reserved address (never fetched on a visitor's behalf). */
export function isPrivateAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number, number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = address.toLowerCase();
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    // «::ffff:7f00:1» — the form a URL normalises «[::ffff:127.0.0.1]» to.
    const hex = x.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) { const hi = parseInt(hex[1]!, 16); const lo = parseInt(hex[2]!, 16); return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`); }
    // Unspecified, loopback, IPv4-compatible, unique-local, link-local, NAT64, 6to4/Teredo (can wrap a private IPv4), docs.
    return x === '::' || x === '::1' || /^::[0-9a-f]/.test(x) || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x)
      || x.startsWith('64:ff9b:') || x.startsWith('2002:') || x.startsWith('2001:0:') || x.startsWith('2001::') || x.startsWith('2001:db8');
  }
  return true;
}
const defaultLookup: Lookup = async (host) => (await dnsLookup(host, { all: true })).map((r) => r.address);

export class ReadError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
/** Only http(s) on the usual ports, to public addresses — checked again on every redirect. */
async function checkUrl(raw: string, lookup: Lookup): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ReadError(400, 'BAD_URL', 'Not a valid link'); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new ReadError(400, 'BAD_URL', 'Only http(s) links');
  if (url.port && !['80', '443'].includes(url.port)) throw new ReadError(400, 'BAD_URL', 'Only the usual web ports');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new ReadError(400, 'PRIVATE_ADDRESS', 'Private address');
  const addresses = isIP(host) ? [host] : await lookup(host).catch(() => { throw new ReadError(400, 'BAD_HOST', 'Unknown site'); });
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new ReadError(400, 'PRIVATE_ADDRESS', 'Private address');
  return url;
}
async function readBody(response: Response, cap: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > cap) throw new ReadError(413, 'TOO_LARGE', 'The file is too large');
  if (!response.body) return new Uint8Array(await response.arrayBuffer()).slice(0, cap);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) { await reader.cancel().catch(() => undefined); throw new ReadError(413, 'TOO_LARGE', 'The file is too large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»' };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ENTITIES[e.toLowerCase()] ?? m;
});
/** A page's readable text (title, headings, paragraphs, list items), without scripts, menus and markup. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decode((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim());
  const main = html.match(/<(article|main)\b[\s\S]*?<\/\1>/i)?.[0] || html.match(/<body\b[\s\S]*<\/body>/i)?.[0] || html;
  const text = decode(main
    .replace(/<(script|style|noscript|svg|template|iframe|form|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, n: string) => `\n\n${'#'.repeat(Number(n))} `)
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|section|h[1-6]|ul|ol|tr|table|blockquote|pre)>/gi, '\n')
    .replace(/<(td|th)\b[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text };
}

export async function readPage(raw: string, { fetch: request = fetch, lookup = defaultLookup }: { fetch?: typeof fetch; lookup?: Lookup } = {}): Promise<{ url: string; title: string; text: string; kind: 'html' | 'pdf' | 'text'; truncated: boolean }> {
  let url = await checkUrl(raw.trim(), lookup);
  let response: Response | undefined;
  for (let hop = 0; hop < 5; hop += 1) {
    response = await request(url.href, {
      redirect: 'manual', signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'ShamShaheenReader/1.0 (+https://spculculat-oss.github.io/Sham-Perfume/)', Accept: 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5' },
    }).catch((error: unknown) => { throw new ReadError(502, 'FETCH_FAILED', error instanceof Error ? error.message : 'The site did not answer'); });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = await checkUrl(new URL(response.headers.get('location')!, url).href, lookup);
      continue;
    }
    break;
  }
  if (!response || response.status >= 300) throw new ReadError(502, 'FETCH_FAILED', `The site answered ${response?.status ?? 'nothing'}`);
  const type = (response.headers.get('content-type') || '').toLowerCase();
  const pdf = type.includes('application/pdf') || /\.pdf($|\?)/i.test(url.pathname);
  if (pdf) {
    const bytes = await readBody(response, 15 * 1024 * 1024);
    const { extractText, getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(bytes);
    const { text } = await extractText(doc, { mergePages: true });
    const clean = String(text).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return { url: url.href, title: decodeURIComponent(url.pathname.split('/').pop() || 'PDF'), text: clean.slice(0, MAX_READ), kind: 'pdf', truncated: clean.length > MAX_READ };
  }
  if (!/text\/|html|xml|json/.test(type) && type) throw new ReadError(415, 'UNSUPPORTED', 'Only web pages, text and PDF can be read');
  const body = new TextDecoder('utf-8').decode(await readBody(response, 3 * 1024 * 1024));
  const page = /html|xml/.test(type) || /<html|<body/i.test(body.slice(0, 2000)) ? htmlToText(body) : { title: url.hostname, text: body.trim() };
  return { url: url.href, title: page.title || url.hostname, text: page.text.slice(0, MAX_READ), kind: /html|xml/.test(type) ? 'html' : 'text', truncated: page.text.length > MAX_READ };
}

// ── Web search ──────────────────────────────────────────────────────────────────────────────────────────────
export interface SearchResult { title: string; url: string; snippet: string }
export async function webSearch(query: string, language: SupportedLanguage, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }): Promise<{ answer?: string; results: SearchResult[]; kind: 'web' | 'encyclopedia' }> {
  const q = query.trim().slice(0, 300);
  // 1) The AI platform's own live web search (its answer with the pages it used).
  if (env.GEMINI_API_KEY?.trim() && env.SHAM_WORKSPACE_WEB_SEARCH?.trim().toLowerCase() !== 'off') {
    try {
      const model = env.GEMINI_SEARCH_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
      const response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY.trim() },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${q}\n\n(${language === 'ar' ? 'جاوب بالعربي باختصار ومن نتايج البحث بس' : `Answer briefly in ${language}, from the search results only`})` }] }], tools: [{ google_search: {} }] }),
      });
      if (response.ok) {
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> };
        const candidate = data.candidates?.[0];
        const answer = (candidate?.content?.parts || []).map((p) => p.text || '').join('').trim();
        const results = (candidate?.groundingMetadata?.groundingChunks || []).flatMap((c) => (c.web?.uri ? [{ title: c.web.title || c.web.uri, url: c.web.uri, snippet: '' }] : [])).slice(0, 8);
        if (answer && results.length) return { answer, results, kind: 'web' };
      }
    } catch { /* falls through to the next source */ }
  }
  // 2) A live-search platform, when one is connected.
  const statuses = engineStatuses(env);
  if (statuses.find((s) => s.id === 'perplexity')?.configured) {
    try {
      let sources: SearchResult[] = [];
      const answer = await callEngine('perplexity', 'Answer from current web results, briefly, with the sources you used.', [{ role: 'user', text: q }], {
        env, fetch: request, signal: AbortSignal.timeout(25_000), temperature: 0.2, maxTokens: 900,
        onSources: (found) => { sources = found.map((s) => ({ title: s.title || s.url, url: s.url, snippet: '' })); },
      });
      if (answer && sources.length) return { answer, results: sources.slice(0, 8), kind: 'web' };
    } catch { /* falls through */ }
  }
  // 3) The free encyclopedia API (no key, official).
  const results: SearchResult[] = [];
  for (const wiki of [...new Set([language === 'ar' ? 'ar' : language, 'en'])].filter((l) => /^[a-z]{2}$/.test(l))) {
    try {
      const url = `https://${wiki}.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=5&origin=*&srsearch=${encodeURIComponent(q)}`;
      const response = await request(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'ShamShaheen/1.0 (+https://spculculat-oss.github.io/Sham-Perfume/)' } });
      if (!response.ok) continue;
      const data = await response.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
      for (const hit of data.query?.search || []) {
        results.push({ title: hit.title, url: `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`, snippet: decode(hit.snippet.replace(/<[^>]+>/g, '')).trim() });
      }
      if (results.length >= 5) break;
    } catch { /* next */ }
  }
  return { results: results.slice(0, 8), kind: 'encyclopedia' };
}

// ── Images ──────────────────────────────────────────────────────────────────────────────────────────────────
export async function makeImage(prompt: string, image: string | undefined, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }): Promise<string | undefined> {
  if (wantsRealPhoto(prompt)) throw new ReadError(400, 'REAL_PHOTO_REQUIRES_SEARCH', 'Use image search for real photographs');
  const key = env.GEMINI_API_KEY?.trim();
  if (!key || env.SHAM_WORKSPACE_IMAGES?.trim().toLowerCase() === 'off') return undefined;
  const model = env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image';
  const parts: object[] = [{ text: prompt.slice(0, 2000) + '\nDo not add AI vendor names, provider credits, or fake provenance text. The site adds its own sharin ai signature afterward. Preserve any existing embedded provenance or rights marks when editing.' }];
  const inline = image?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (inline) parts.push({ inlineData: { mimeType: inline[1], data: inline[2] } });
  try {
    const response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(45_000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
    });
    if (!response.ok) return undefined;
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
    const out = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    return out?.data ? `data:${out.mimeType || 'image/png'};base64,${out.data}` : undefined;
  } catch { return undefined; }
}

// ── The conversation ────────────────────────────────────────────────────────────────────────────────────────
interface AskBody { messages?: unknown; language?: unknown; task?: unknown; context?: unknown; search?: unknown }
export function askTurns(body: AskBody, resolveReferences = true): EngineTurn[] {
  const raw = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  const turns = raw.flatMap((m) => {
    const { role, text } = (m && typeof m === 'object' ? m : {}) as { role?: unknown; text?: unknown };
    return (role === 'user' || role === 'assistant') && typeof text === 'string' && text.trim() ? [{ role, text: text.slice(0, 20_000) } as EngineTurn] : [];
  });
  while (turns.length && turns[0]!.role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1]!.role !== 'user') throw new ReadError(400, 'BAD_REQUEST', 'The last message must be the visitor’s');
  const lastUser = turns[turns.length - 1]!;
  if (resolveReferences) turns[turns.length - 1] = { role: 'user', text: contextualMessage(lastUser.text, turns.slice(0, -1)) };
  // The visitor's files and pages, attached to his last message (capped).
  const files = Array.isArray(body.context) ? body.context.slice(0, 12) : [];
  let room = MAX_CONTEXT;
  const blocks: string[] = [];
  for (const f of files) {
    const { name, text } = (f && typeof f === 'object' ? f : {}) as { name?: unknown; text?: unknown };
    if (typeof name !== 'string' || typeof text !== 'string' || room <= 0) continue;
    const part = text.slice(0, room);
    room -= part.length;
    blocks.push(`ملف: «${name.slice(0, 120)}»${part.length < text.length ? ' (مقتطع)' : ''}\n${part}`);
  }
  if (blocks.length) {
    const last = turns[turns.length - 1]!;
    turns[turns.length - 1] = { role: 'user', text: `${blocks.join('\n\n---\n\n')}\n\n---\n\n${last.text}` };
  }
  return turns;
}

export async function askWorkspace(body: AskBody, { env, fetch: request = fetch, signal }: { env: Env; fetch?: typeof fetch; signal?: AbortSignal }): Promise<{ reply: string; sources: SearchResult[] }> {
  const language = languageOf(body.language);
  const task = body.task === 'plan' || body.task === 'summarize' ? body.task : 'chat';
  const rawTurns = askTurns({ ...body, context: [] }, false);
  const latest = rawTurns[rawTurns.length - 1]!;
  const photoReply = task === 'chat' ? realPhotoReply(latest.text, rawTurns.slice(0, -1), language) : undefined;
  if (photoReply) return { reply: photoReply, sources: [] };
  const turns = askTurns(body);
  let sources: SearchResult[] = [];
  if (body.search === true) {
    const searchTurns = askTurns({ ...body, context: [] }, false);
    const latest = searchTurns[searchTurns.length - 1]!.text;
    const focus = conversationFocus(latest, searchTurns.slice(0, -1));
    const asked = (focus ? `${focus.question} — ${latest}` : latest).slice(0, 300);
    // Never search a contextless 'show me pictures' or a JSON context wrapper.
    const found = isContextFollowUp(latest) && !focus ? { results: [] as SearchResult[], answer: undefined }
      : await webSearch(asked, language, { env, fetch: request }).catch(() => ({ results: [] as SearchResult[], answer: undefined }));
    sources = found.results;
    if (sources.length) {
      const list = sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}${s.snippet ? `\n${s.snippet}` : ''}`).join('\n');
      const last = turns[turns.length - 1]!;
      turns[turns.length - 1] = { role: 'user', text: `نتايج بحث ويب لسه طالعة:\n${list}${found.answer ? `\n\nملخص البحث: ${found.answer.slice(0, 4000)}` : ''}\n\n---\n\n${last.text}` };
    }
  }
  const engines = configuredEngines(env);
  if (!engines.length) throw new ReadError(503, 'NO_ENGINE', 'No AI platform is open right now');
  const system = workspaceInstruction(language, task);
  for (const id of engines) {
    if (signal?.aborted) break;
    try {
      const reply = await callEngine(id, system, turns, {
        env, fetch: request, signal: AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]),
        temperature: task === 'plan' ? 0.2 : 0.6, maxTokens: task === 'plan' ? 1200 : 6000, maxChars: 60_000,
      });
      if (typeof reply === 'string' && reply.trim()) return { reply: reply.trim(), sources };
    } catch { /* the next platform */ }
  }
  throw new ReadError(503, 'ENGINES_BUSY', 'The AI platforms are busy, try again in a minute');
}

// ── The owner's Notion and Slack ────────────────────────────────────────────────────────────────────────────
const notionHeaders = (env: Env) => ({ Authorization: `Bearer ${env.NOTION_TOKEN!.trim()}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' });
export async function notionSearch(query: string, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }) {
  const response = await request('https://api.notion.com/v1/search', { method: 'POST', headers: notionHeaders(env), body: JSON.stringify({ query: query.slice(0, 200), page_size: 10 }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new ReadError(502, 'NOTION_FAILED', `Notion answered ${response.status}`);
  const data = await response.json() as { results?: Array<{ id: string; url?: string; object?: string; properties?: Record<string, { title?: Array<{ plain_text?: string }> }>; title?: Array<{ plain_text?: string }> }> };
  return (data.results || []).map((r) => {
    const titled = r.title || Object.values(r.properties || {}).find((p) => p.title)?.title || [];
    return { id: r.id, url: r.url || '', kind: r.object || 'page', title: titled.map((t) => t.plain_text || '').join('') || '—' };
  });
}
export async function notionPage(title: string, text: string, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }) {
  const parent = env.NOTION_PARENT_PAGE_ID?.trim();
  if (!parent) throw new ReadError(503, 'NOTION_NO_PARENT', 'Set NOTION_PARENT_PAGE_ID on the server');
  const chunks = text.slice(0, 90_000).split(/\n{2,}/).flatMap((p) => p.match(/[\s\S]{1,1900}/g) || []).slice(0, 95);
  const children = chunks.map((content) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content } }] } }));
  const response = await request('https://api.notion.com/v1/pages', {
    method: 'POST', headers: notionHeaders(env), signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ parent: { page_id: parent }, properties: { title: { title: [{ text: { content: title.slice(0, 200) || 'Shaheen' } }] } }, children }),
  });
  if (!response.ok) throw new ReadError(502, 'NOTION_FAILED', `Notion answered ${response.status}`);
  const data = await response.json() as { url?: string };
  return { url: data.url || '' };
}
export async function slackSend(text: string, { env, fetch: request = fetch }: { env: Env; fetch?: typeof fetch }) {
  const hook = env.SLACK_WEBHOOK_URL?.trim();
  if (!hook || !/^https:\/\/hooks\.slack\.com\//.test(hook)) throw new ReadError(503, 'SLACK_NOT_CONFIGURED', 'Set SLACK_WEBHOOK_URL on the server');
  const response = await request(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 3900) }), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new ReadError(502, 'SLACK_FAILED', `Slack answered ${response.status}`);
  return { ok: true };
}

// ── The router ──────────────────────────────────────────────────────────────────────────────────────────────
export function createWorkspaceRouter(options: WorkspaceOptions = {}): express.Router {
  const env = options.env || process.env;
  const request = options.fetch || fetch;
  const lookup = options.lookup || defaultLookup;
  const router = express.Router();
  router.use(express.json({ limit: '4mb' }));
  const limits = { ask: new RateLimiter(30, 60_000), search: new RateLimiter(20, 60_000), read: new RateLimiter(20, 60_000), image: new RateLimiter(8, 60_000), owner: new RateLimiter(30, 60_000) };
  const fail = (res: express.Response, error: unknown) => {
    if (error instanceof ReadError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
    console.error('[workspace]', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL' });
  };
  const limited = (kind: keyof typeof limits) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!limits[kind].allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, wait a minute', code: 'RATE_LIMITED' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    next();
  };

  router.get('/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const statuses = engineStatuses(env);
    res.json({
      ai: configuredEngines(env).length > 0,
      search: env.GEMINI_API_KEY?.trim() || statuses.find((s) => s.id === 'perplexity')?.configured ? 'web' : 'encyclopedia',
      image: env.GEMINI_API_KEY?.trim() && env.SHAM_WORKSPACE_IMAGES?.trim().toLowerCase() !== 'off' ? 'ai' : 'off',
      notion: Boolean(env.NOTION_TOKEN?.trim()), slack: Boolean(env.SLACK_WEBHOOK_URL?.trim()),
    });
  });
  router.post('/ask', limited('ask'), async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    try { res.json(await askWorkspace(req.body || {}, { env, fetch: request, signal: controller.signal })); } catch (error) { fail(res, error); }
  });
  router.post('/search', limited('search'), async (req, res) => {
    const q = typeof req.body?.q === 'string' ? req.body.q.trim() : '';
    if (!q) { res.status(400).json({ error: 'Empty search', code: 'BAD_REQUEST' }); return; }
    try { res.json(await webSearch(q, languageOf(req.body?.language), { env, fetch: request })); } catch (error) { fail(res, error); }
  });
  router.post('/read', limited('read'), async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    try { res.json(await readPage(url, { fetch: request, lookup })); } catch (error) { fail(res, error); }
  });
  router.post('/image', limited('image'), async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) { res.status(400).json({ error: 'Empty prompt', code: 'BAD_REQUEST' }); return; }
    try {
      const image = await makeImage(prompt, typeof req.body?.image === 'string' ? req.body.image : undefined, { env, fetch: request });
      if (!image) { res.status(503).json({ error: 'No image engine', code: 'NO_IMAGE_ENGINE' }); return; }
      res.json({ image });
    } catch (error) { fail(res, error); }
  });

  // The owner only: his Notion and Slack (the keys never leave the server).
  const digest = (v: string) => createHash('sha256').update(v).digest();
  const owner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = env.SHAM_ADMIN_TOKEN?.trim() || '';
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token.length < 12) { res.status(503).json({ error: 'Admin is disabled', code: 'ADMIN_NOT_CONFIGURED' }); return; }
    if (!provided || !timingSafeEqual(digest(provided), digest(token))) { res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }); return; }
    next();
  };
  router.post('/owner/notion/search', limited('owner'), owner, async (req, res) => {
    if (!env.NOTION_TOKEN?.trim()) { res.status(503).json({ error: 'Set NOTION_TOKEN on the server', code: 'NOTION_NOT_CONFIGURED' }); return; }
    try { res.json({ results: await notionSearch(String(req.body?.q || ''), { env, fetch: request }) }); } catch (error) { fail(res, error); }
  });
  router.post('/owner/notion/page', limited('owner'), owner, async (req, res) => {
    if (!env.NOTION_TOKEN?.trim()) { res.status(503).json({ error: 'Set NOTION_TOKEN on the server', code: 'NOTION_NOT_CONFIGURED' }); return; }
    try { res.json(await notionPage(String(req.body?.title || ''), String(req.body?.text || ''), { env, fetch: request })); } catch (error) { fail(res, error); }
  });
  router.post('/owner/slack/send', limited('owner'), owner, async (req, res) => {
    try { res.json(await slackSend(String(req.body?.text || ''), { env, fetch: request })); } catch (error) { fail(res, error); }
  });
  return router;
}
