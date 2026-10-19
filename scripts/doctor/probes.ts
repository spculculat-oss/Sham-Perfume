/**
 * Health probes of «طبيب شاهين». Light by design (≈8 small requests per run, one cached chat question),
 * so a run every 10 minutes costs the site nothing noticeable. Each probe returns a Finding.
 */
import type { GitHub } from './github';

export type CheckId = 'api' | 'deploy' | 'modes' | 'chat' | 'cors' | 'pages' | 'runtime' | 'ci' | 'media';
export type Status = 'ok' | 'warn' | 'fail' | 'skip';
export interface Finding { id: CheckId; status: Status; summary: string; data?: Record<string, unknown> }

export interface ProbeContext {
  site: string;            // API + Vercel site, e.g. https://sham-perfume-49bf.vercel.app
  pages: string;           // GitHub Pages site
  pagesOrigin: string;     // origin allowed by CORS
  vercelProject: string;   // name in the "Vercel – <project>" commit status
  visitorId: string;
  adminToken?: string;
  github?: GitHub;
  main?: { sha: string; date: string };
  fetch: typeof fetch;
  now?: number;
}

export const VENDORS = /\b(gemini|google|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|perplexity|llama|qwen|mistral)\b|جيمي?ني|جوجل|شات ?جي|كلود|ديب ?سيك/i;
export const PROBE_QUESTION = { model: 'fast', language: 'ar', message: 'إيه الفرق بين EDP و EDT؟' };

async function timed(ctx: ProbeContext, url: string, init: RequestInit = {}, timeoutMs = 20_000) {
  const started = Date.now();
  try {
    const response = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const text = await response.text();
    let json: any; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: response.status, headers: response.headers, text, json, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, headers: new Headers(), text: String((error as Error)?.message || error), json: undefined, ms: Date.now() - started };
  }
}

const minutesSince = (iso: string | undefined, now: number) => (iso ? Math.round((now - Date.parse(iso)) / 60_000) : 0);

export async function probeApi(ctx: ProbeContext): Promise<Finding> {
  const r = await timed(ctx, `${ctx.site}/api/health`, {}, 15_000);
  if (r.status !== 200 || r.json?.status !== 'ok') return { id: 'api', status: 'fail', summary: `الـ API مش بيرد (HTTP ${r.status})`, data: { http: r.status, ms: r.ms } };
  return { id: 'api', status: r.ms > 8000 ? 'warn' : 'ok', summary: `شغال في ${(r.ms / 1000).toFixed(1)}ث`, data: { http: r.status, ms: r.ms, version: r.json.version || null } };
}

/** Is the live site running main? If not, why (Vercel rate limit, failed build, still deploying)? */
export async function probeDeploy(ctx: ProbeContext, liveVersion: string | null): Promise<Finding> {
  const now = ctx.now ?? Date.now();
  if (!ctx.github || !ctx.main) return { id: 'deploy', status: 'skip', summary: 'مفيش وصول لـ GitHub' };
  const mainSha = ctx.main.sha;
  const live = liveVersion && liveVersion !== 'dev' ? liveVersion : null;
  if (live && mainSha.startsWith(live.slice(0, 7))) return { id: 'deploy', status: 'ok', summary: `الموقع على آخر نسخة (${mainSha.slice(0, 7)})`, data: { live, main: mainSha } };
  let status;
  try { status = (await ctx.github.statuses(mainSha)).find((s) => s.context === `Vercel – ${ctx.vercelProject}`); }
  catch (error) { return { id: 'deploy', status: 'skip', summary: `تعذّر قراءة حالة النشر: ${(error as Error).message.slice(0, 80)}` }; }
  const commitAge = minutesSince(ctx.main.date, now);
  const base = { live, main: mainSha, commitAgeMin: commitAge };
  if (!status) {
    return commitAge < 15
      ? { id: 'deploy', status: 'ok', summary: 'النشر لسه هيبدأ', data: { ...base, reason: 'waiting' } }
      : { id: 'deploy', status: 'warn', summary: `Vercel ما بدأش نشر آخر نسخة من ${commitAge} دقيقة`, data: { ...base, reason: 'no_deploy' } };
  }
  const ageMin = minutesSince(status.updated_at || status.created_at, now);
  const data = { ...base, state: status.state, description: status.description, statusAgeMin: ageMin };
  if (status.state === 'success') {
    // Vercel says READY but the live API reports another commit: an old instance or the version is unknown (old code).
    if (!live) return { id: 'deploy', status: 'ok', summary: 'Vercel نشر آخر نسخة', data: { ...data, reason: 'ready' } };
    return ageMin > 15
      ? { id: 'deploy', status: 'warn', summary: `Vercel نشر ${mainSha.slice(0, 7)} لكن الموقع لسه بيقول ${live.slice(0, 7)}`, data: { ...data, reason: 'mismatch' } }
      : { id: 'deploy', status: 'ok', summary: 'النسخة الجديدة بتتفعل', data: { ...data, reason: 'ready' } };
  }
  if (status.state === 'pending') {
    return ageMin > 30
      ? { id: 'deploy', status: 'warn', summary: `النشر معلّق من ${ageMin} دقيقة`, data: { ...data, reason: 'stuck' } }
      : { id: 'deploy', status: 'ok', summary: 'Vercel بينشر دلوقتي', data: { ...data, reason: 'deploying' } };
  }
  const rateLimited = /rate.?limit/i.test(status.description || '');
  return {
    id: 'deploy', status: 'fail',
    summary: rateLimited ? `Vercel رفض النشر (حد النشر اليومي) من ${ageMin} دقيقة — الموقع على نسخة قديمة` : `بناء Vercel فشل: ${status.description || status.state}`,
    data: { ...data, reason: rateLimited ? 'rate_limited' : 'build_failed', url: status.target_url },
  };
}

export async function probeModes(ctx: ProbeContext): Promise<Finding> {
  const r = await timed(ctx, `${ctx.site}/api/models`);
  if (r.status !== 200 || !Array.isArray(r.json?.models)) return { id: 'modes', status: 'fail', summary: `قائمة الأوضاع مش متاحة (HTTP ${r.status})`, data: { http: r.status } };
  const ready = r.json.models.filter((m: { hasApiKey?: boolean }) => m.hasApiKey).map((m: { id: string }) => m.id);
  if (VENDORS.test(r.text)) return { id: 'modes', status: 'fail', summary: 'اسم مزوّد ظاهر للزوار في قائمة الأوضاع', data: { ready, leak: r.text.match(VENDORS)?.[0] } };
  if (r.json.enabled === false) return { id: 'modes', status: 'warn', summary: 'شاهين مقفول من الإعدادات', data: { ready, enabled: false } };
  if (!ready.length) return { id: 'modes', status: 'fail', summary: 'ولا وضع شغال — مفيش مفتاح ذكاء اصطناعي صالح', data: { ready } };
  return { id: 'modes', status: 'ok', summary: `الأوضاع: ${ready.join('، ')}`, data: { ready } };
}

export async function probeChat(ctx: ProbeContext): Promise<Finding> {
  const r = await timed(ctx, `${ctx.site}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: ctx.site, 'x-sham-visitor': ctx.visitorId },
    body: JSON.stringify({ ...PROBE_QUESTION, conversationHistory: [] }),
  }, 65_000);
  const reply = typeof r.json?.reply === 'string' ? r.json.reply : '';
  const code = r.json?.code as string | undefined;
  const data = { http: r.status, ms: r.ms, code, replyChars: reply.length };
  if (r.status === 200 && !reply.trim()) return { id: 'chat', status: 'fail', summary: 'شاهين رجّع رد فاضي', data: { ...data, problem: 'empty' } };
  if (r.status === 200 && VENDORS.test(reply)) return { id: 'chat', status: 'fail', summary: `الرد فيه اسم مزوّد «${reply.match(VENDORS)![0]}»`, data: { ...data, problem: 'vendor_leak', excerpt: reply.slice(0, 600) } };
  if (r.status === 200) return { id: 'chat', status: r.ms > 30_000 ? 'warn' : 'ok', summary: `رد في ${(r.ms / 1000).toFixed(1)}ث`, data };
  if (r.status === 429 || code === 'SHAHEEN_BUSY') return { id: 'chat', status: 'warn', summary: `شاهين مشغول (${code || r.status}) — حصة المزوّد`, data: { ...data, problem: 'busy' } };
  return { id: 'chat', status: 'fail', summary: `السؤال فشل: HTTP ${r.status} ${code || ''}`.trim(), data: { ...data, problem: 'error' } };
}

export async function probeCors(ctx: ProbeContext, deployCurrent: boolean): Promise<Finding> {
  // Exactly what a browser on the GitHub Pages site does before asking Shaheen (same origin, same headers).
  const pre = await timed(ctx, `${ctx.site}/api/chat`, { method: 'OPTIONS', headers: { origin: ctx.pagesOrigin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } }, 15_000);
  const origin = pre.headers.get('access-control-allow-origin');
  const allow = pre.headers.get('access-control-allow-headers') || '';
  if (origin !== ctx.pagesOrigin || !/content-type/i.test(allow)) {
    return { id: 'cors', status: 'fail', summary: `شاهين على موقع GitHub Pages محجوب: المتصفح مش مسموح له يكلم الـ API (HTTP ${pre.status})`, data: { http: pre.status, origin, allow, current: deployCurrent } };
  }
  return { id: 'cors', status: 'ok', summary: 'شاهين على GitHub Pages يقدر يكلم الـ API', data: { allow } };
}

export async function probePages(ctx: ProbeContext): Promise<Finding> {
  const page = await timed(ctx, ctx.pages, {}, 20_000);
  if (page.status !== 200) return { id: 'pages', status: 'fail', summary: `موقع GitHub Pages مش شغال (HTTP ${page.status})`, data: { http: page.status } };
  const src = page.text.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
  if (!src) return { id: 'pages', status: 'fail', summary: 'صفحة Pages من غير ملف التطبيق', data: { http: 200 } };
  const asset = await timed(ctx, new URL(src, ctx.pages).href, { method: 'HEAD' }, 20_000);
  if (asset.status !== 200) return { id: 'pages', status: 'fail', summary: `ملف التطبيق على Pages مش موجود (HTTP ${asset.status})`, data: { asset: src, http: asset.status } };
  return { id: 'pages', status: 'ok', summary: `شغال في ${(page.ms / 1000).toFixed(1)}ث`, data: { ms: page.ms, asset: src } };
}

export async function probeRuntime(ctx: ProbeContext): Promise<Finding> {
  if (!ctx.adminToken) return { id: 'runtime', status: 'skip', summary: 'من غير SHAM_ADMIN_TOKEN — مش هقدر أشوف عدّادات الخادم' };
  const r = await timed(ctx, `${ctx.site}/api/admin/maintenance`, { headers: { authorization: `Bearer ${ctx.adminToken}` } }, 15_000);
  if (r.status === 404) return { id: 'runtime', status: 'skip', summary: 'الموقع الحي لسه مافيهوش واجهة الصيانة (نسخة قديمة)' };
  if (r.status === 401 || r.status === 503) return { id: 'runtime', status: 'warn', summary: `مفتاح الإدارة مرفوض (${r.json?.code || r.status}) — لازم يطابق SHAM_ADMIN_TOKEN في Vercel`, data: { http: r.status } };
  if (r.status !== 200) return { id: 'runtime', status: 'warn', summary: `واجهة الصيانة ردّت HTTP ${r.status}`, data: { http: r.status } };
  const w = r.json.window || {};
  const served = (w.requests || 0) - (w.rateLimited || 0);
  const cooling = Object.entries(r.json.providers || {}).filter(([, p]: [string, any]) => p.coolingMs > 0).map(([id]) => id);
  const data = { ...w, cooling, version: r.json.version, uptimeS: r.json.uptimeS };
  const rate = Math.round((w.errorRate || 0) * 100);
  if (served >= 8 && w.errorRate >= 0.3) return { id: 'runtime', status: 'fail', summary: `${rate}% من أسئلة الزوار فشلت آخر 10 دقايق (${served} سؤال)`, data };
  if ((served >= 5 && w.errorRate >= 0.1) || (w.latencyMs?.p95 || 0) > 30_000) return { id: 'runtime', status: 'warn', summary: `أخطاء ${rate}% · p95 ${(w.latencyMs?.p95 / 1000 || 0).toFixed(1)}ث`, data };
  return { id: 'runtime', status: 'ok', summary: served ? `${served} سؤال آخر 10 دقايق · أخطاء ${rate}% · p95 ${((w.latencyMs?.p95 || 0) / 1000).toFixed(1)}ث` : 'مفيش أسئلة آخر 10 دقايق على النسخة دي', data };
}

/** CI of main: a failed build/test of the latest commit is a code problem. */
export async function probeCi(ctx: ProbeContext): Promise<Finding> {
  if (!ctx.github) return { id: 'ci', status: 'skip', summary: 'مفيش وصول لـ GitHub' };
  try {
    const runs = await ctx.github.runs('pages.yml', 'main', 5);
    const done = runs.find((r) => r.status === 'completed');
    if (!done) return { id: 'ci', status: 'ok', summary: 'مفيش فحص مكتمل لسه' };
    const data = { runId: done.id, sha: done.head_sha, url: done.html_url, conclusion: done.conclusion };
    if (done.conclusion === 'failure') return { id: 'ci', status: 'fail', summary: `فحص وبناء main فشل (${done.head_sha.slice(0, 7)})`, data };
    return { id: 'ci', status: 'ok', summary: `آخر فحص لـ main: ${done.conclusion}`, data };
  } catch (error) {
    return { id: 'ci', status: 'skip', summary: `تعذّر قراءة الفحوص: ${(error as Error).message.slice(0, 80)}` };
  }
}

export async function probeMedia(ctx: ProbeContext): Promise<Finding> {
  const r = await timed(ctx, `${ctx.site}/api/media?type=image&q=rose%20damascena&lang=en`, {}, 20_000);
  const count = Array.isArray(r.json?.items) ? r.json.items.length : Array.isArray(r.json?.images) ? r.json.images.length : undefined;
  if (r.status !== 200) return { id: 'media', status: 'warn', summary: `الصور مش متاحة (HTTP ${r.status})`, data: { http: r.status } };
  return { id: 'media', status: 'ok', summary: count === undefined ? 'الصور شغالة' : `${count} صورة`, data: { http: 200 } };
}

export async function runProbes(ctx: ProbeContext): Promise<Finding[]> {
  const [api, modes, pages, ci, runtime, media] = await Promise.all([probeApi(ctx), probeModes(ctx), probePages(ctx), probeCi(ctx), probeRuntime(ctx), probeMedia(ctx)]);
  const deploy = await probeDeploy(ctx, (api.data?.version as string) || null);
  const [chat, cors] = await Promise.all([probeChat(ctx), probeCors(ctx, deploy.status === 'ok' && Boolean(api.data?.version))]);
  return [api, deploy, modes, chat, cors, pages, runtime, ci, media];
}
