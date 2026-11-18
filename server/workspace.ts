import { blockBuilderReply, parseToolSpec, runTool, TOOL_BUILDER_INSTRUCTION } from '../src/utils/shaheenToolBuilder';
import { REAL_PHOTO_INSTRUCTION, realPhotoReply, wantsRealPhoto } from '../src/utils/realPhotos';
import { IMAGE_CRAFT_INSTRUCTION, IMAGE_HONESTY_INSTRUCTION, craftEditPrompt, craftImagePrompt, isImageAspect, isImageStyle, type ImageAspect, type ImageStyleId } from '../src/utils/imageCraft';
import { CONTINUITY_INSTRUCTION, contextualMessage, conversationFocus, isContextFollowUp } from '../src/utils/conversationContext';
/**
 * «مساحة شاهين»: Shaheen as a general assistant — any subject, not perfume only.
 *   /api/workspace/status   what is open right now (no vendor names: visitors never see them)
 *   /api/workspace/ask      a conversation (chat, a multi-step plan, a summary), with the visitor's files as context
 *                           and, on request, live web results with their links
 *   /api/workspace/search   web search: the AI platform's own search when it has one, else the free encyclopedia API
 *   /api/workspace/read     a public page or PDF read as text (SSRF-guarded: public addresses only, size and time caps)
 *   /api/workspace/image    an image made or edited by the AI platform (503 NO_IMAGE_ENGINE → an honest unavailable message; no external generator fallback)
 *   /api/workspace/video/*  real moving footage from the professional video engine (off until the owner turns it on;
 *                           see server/videoEngine.ts)
 *   /api/workspace/owner/*  the owner's own Notion and Slack (Bearer SHAM_ADMIN_TOKEN; keys stay on the server)
 * Code runs, files, documents, image editing and reading aloud happen in the visitor's browser (src/workspace):
 * nothing of the visitor's files is stored here.
 */
import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { EngineHealth } from './core/engineHealth';
import { NATURAL_TALK_INSTRUCTION, PRECISE_ANSWER_INSTRUCTION, needInstruction, polishReply } from '../src/utils/naturalTalk';
import {
  DEEP_PLAN_INSTRUCTION, THINKING_CRAFT_INSTRUCTION, fixReply, needsRevision, profileQuestion, reviewReply, revisionRequest, thinkingHint, withPlan,
} from '../src/utils/thinkingCraft';
import { ImageReadError, readImage } from './imageReader';
import { callEngine, engineStatuses, failureDetail, fastGeminiModel, groundingSources, GEMINI_DEFAULT_MODEL, type EngineFailure, type EngineTurn } from './core/engines';
import { googleHealth } from './core/googleHealth';
import { needsLiveWeb } from '../src/utils/liveWeb';
import { RateLimiter, clientKey } from './core/rateLimit';
import { cleanVideoRequest, dailyLimit, DailyBudget, readJob, signJob, startVideo, videoAccess, videoBytes, VideoError, videoStatus } from './videoEngine';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { adminSecret } from './core/adminSecret';

type Env = Record<string, string | undefined>;
type Lookup = (host: string) => Promise<string[]>;
export interface WorkspaceOptions { env?: Env; fetch?: typeof fetch; lookup?: Lookup; videoBudget?: DailyBudget; health?: EngineHealth }

/** The AI platforms a workspace turn may use, best first (live search has its own route). */
const ORDER = ['gemini', 'openai', 'claude', 'deepseek', 'openrouter', 'self_hosted'] as const;
export const configuredEngines = (env: Env) => {
  const statuses = engineStatuses(env);
  return ORDER.filter((id) => statuses.find((s) => s.id === id)?.configured);
};

const MAX_CONTEXT = 60_000;
const MAX_READ = 40_000;
const LANGS = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
export const languageOf = (value: unknown): SupportedLanguage => (typeof value === 'string' && LANGS.has(value as SupportedLanguage) ? value as SupportedLanguage : 'ar');

/** Who Shaheen is in the workspace: a general assistant (perfume is his deepest specialty, not his limit). */
export type WorkspaceTask = 'chat' | 'plan' | 'summarize' | 'site' | 'storyboard' | 'graphic' | 'block' | 'bot' | 'blocks';
export function workspaceInstruction(language: SupportedLanguage, task: WorkspaceTask = 'chat'): string {
  const name = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'العربية';
  const base = `${CONTINUITY_INSTRUCTION}\n${REAL_PHOTO_INSTRUCTION}\nأنت «شاهين»، مساعد ذكاء اصطناعي شامل داخل منصة «شام». بتساعد في أي موضوع: كتابة، ترجمة، دراسة وشرح، برمجة ومواقع، تحليل بيانات وجداول، أفكار وتسويق، شغل ومستندات، أسئلة عامة — والعطور تخصصك العميق مش حدودك.
${NATURAL_TALK_INSTRUCTION}
هويتك «شاهين» بس: ما تذكرش اسم أي نموذج أو شركة ذكاء اصطناعي، ولو اتسألت قول إنك مساعد منصة شام والتفاصيل التقنية مش متاحة.
رد بلغة المستخدم (${name}). لو بيكتب عربي مصري رد بالمصري العامي الواضح؛ ولو لهجة تانية رد بيها؛ ولو فصحى رد بفصحى بسيطة. افهم السياق والكلام اللي فات، وادخل في الإجابة على طول من غير مقدمات.
كن صادق: ما تخترعش مصادر أو أرقام أو روابط أو أحداث، وقول «مش متأكد» لما الدليل مش كفاية. ما تدّعيش إنك شغّلت كود أو فتحت ملف أو موقع إلا لو نتيجته موجودة قدامك في الرسالة.
لو المستخدم بعت ملفات أو صفحات (هتلاقيها بين علامات «ملف:»)، اعتمد عليها واذكر اسم الملف لما تستشهد بيه.
لو في نتايج بحث ويب مرقّمة، استشهد بيها برقمها [1] [2] ومتستخدمش غيرها كمصدر.
البرمجة: اكتب الكود كامل وشغّال جوّه سياج بلغته (\`\`\`python، \`\`\`javascript، \`\`\`html…). موقع أو صفحة = ملف HTML واحد كامل فيه الـ CSS والـ JavaScript جوّاه في سياج \`\`\`html، علشان المستخدم يشوفه «معاينة حية» على طول. كود بايثون لازم يشتغل في المتصفح (مكتبات بايثون القياسية، وnumpy وpandas وmatplotlib مسموحين) ويطبع نتيجته بـ print.
المستندات: لو طلب مستند أو تقرير أو عرض، اكتبه Markdown منظم (عنوان بـ #، أقسام بـ ##، نقاط، وجداول Markdown للأرقام) — الموقع بيحوّله Word أو Excel أو PowerPoint أو PDF بضغطة. للعرض التقديمي: كل شريحة قسم ## بعنوانها ونقاط قصيرة.
«استوديو الإنشاء» في المساحة فيه أدوات تصميم جاهزة: بناء موقع كامل، بلوكات برمجية (HTML وReact وVue)، تصميم جرافيك (بوست، ستوري، غلاف فيسبوك، صورة يوتيوب، بوستر، كارت شخصي) بتنزل PNG وSVG، شعار وهوية، تصميم روبوتات محادثة بتشتغل في أي موقع من غير سيرفر (ترد وتاخد حجوزات وطلبات وتحوّل على واتساب)، فيديو خيالي، وأدوات المصممين (ألوان ودرجاتها، فحص وضوح الكلام، تدرّجات، ظلال، مقاسات خطوط ومسافات). لو المستخدم طلب حاجة من دول، ساعده في الشات وقوله إن الأداة موجودة في «استوديو الإنشاء» عشان يعدّل وينزّل بنفسه.
${IMAGE_CRAFT_INSTRUCTION}
${IMAGE_HONESTY_INSTRUCTION}
الفيديو المتحرك: الموقع يدعم تصدير فيديو قصير محلياً من صورة بتقريب وتحريك الكاميرا بلا صوت عبر زر «عمل فيديو متحرك» تحت الصورة. ده مش توليد فيديو بالذكاء الاصطناعي ولا تحريك أشخاص أو أشياء داخل المشهد؛ وضّح الفرق بصراحة، ولا تدّعي إنشاء فيديو قبل ضغط الزر ونجاح التسجيل. لو طلب فيديو متحرك، جهّز صورة أساسية بوصف داخل سياج sham-video بدلاً من رفض كل الحركة أو توجيهه لمواقع أخرى. تحريك صورة موجودة يتم محلياً. صيغة الفيديو حسب المتصفح WebM أو MP4، ولا تدّعي دعم GIF أو MP4 تحديداً قبل التحقق.
توقيع الصور المضاف بواسطة الموقع هو sharing ai فقط (توقيع شاهين). لا تطلب كتابة اسم المزود على الصورة ولا تختلق مصدرها، ولا تمح أو تخفِ علامة منشأ أو حقوق مدمجة أصلاً. التوقيع علامة شام وليس إثباتاً أن نموذجاً خاصاً بشام ولّد الصورة.
ممنوع: المساعدة في أذى أو اختراق أو احتيال أو محتوى جنسي لقاصرين أو سلاح؛ ونصايح طبية أو قانونية أو مالية خطيرة من غير ما توجّه لمختص.`;
  if (task === 'blocks') return `${base}\n${TOOL_BUILDER_INSTRUCTION}`;
  if (task === 'plan') {
    return `${base}
مهمتك دلوقتي: تقسّم طلب المستخدم لخطوات تنفّذها أدوات الموقع. رد بـ JSON بس (من غير أي كلام قبله أو بعده) بالشكل:
{"goal":"الهدف باختصار","steps":[{"tool":"search","input":"..."},{"tool":"ask","input":"..."}]}
الأدوات: search (بحث ويب؛ input = عبارة البحث)، read (قراءة صفحة أو PDF؛ input = الرابط)، ask (تفكير/كتابة/تلخيص؛ input = المطلوب، وتقدر تشير لنتيجة خطوة قبلها بـ {{1}} أو {{2}})، image (رسم صورة؛ input = وصف إنجليزي)، python (تشغيل كود بايثون؛ input = الكود كامل ويطبع بـ print)، document (مستند؛ input = "docx" أو "xlsx" أو "pptx" أو "pdf" + ":" + المحتوى أو {{n}})، save (حفظ نتيجة كملف في ملفات المستخدم؛ input = "اسم-الملف.md:" + المحتوى أو {{n}}).
من خطوة لـ 8 خطوات بالكتير، والخطوة الأخيرة غالباً ask بتجمّع النتيجة النهائية للمستخدم.`;
  }
  if (task === 'site') {
    return `${base}
مهمتك دلوقتي: إنت مصمم ومطوّر مواقع محترف في «استوديو شاهين». ابني أو عدّل الموقع اللي المستخدم طالبه. رد بـ JSON بس (من غير أي كلام قبله أو بعده) بالشكل:
{"name":"اسم الموقع","tagline":"جملة قصيرة","lang":"ar","theme":{"base":"#8a5a2b","harmony":"complementary|analogous|triadic|split|mono","dark":false,"font":"cairo|tajawal|amiri|reem|playfair|poppins|serif|grotesk","radius":"sharp|soft|round"},"pages":[{"slug":"index","title":"الرئيسية","sections":[{"type":"hero","title":"...","text":"...","button":"...","link":"contact.html","image":{"prompt":"English description of the photo","alt":"..."}}]}]}
أنواع الأقسام: hero، features (items فيها icon إيموجي وtitle وtext)، about (title وtext وimage)، gallery وproducts (items فيها title وtext وprice اختياري وimage)، steps (items)، faq (items فيها q وa)، cta (title وtext وbutton وlink)، contact (title وtext وemail وphone وwhatsapp وaddress — بس اللي المستخدم إداه، ما تخترعش أرقام أو إيميلات)، text.
الصفحة الأولى slug بتاعها index، والروابط بين الصفحات بالشكل about.html أو #id. من صفحة لـ 6 صفحات، والصفحة من 2 لـ 10 أقسام. اكتب محتوى حقيقي مقنع بلغة المستخدم ومناسب لمجاله (مش «لوريم إيبسوم»)، من غير أسعار أو تقييمات أو أرقام أو عروض مخترعة — سيب السعر فاضي لو مش معروف. وصف كل صورة بالإنجليزي جوّه image.prompt (الموقع بيرسمها). اختار ألوان وخط يناسبوا الهوية.
لو جالك موقع حالي بـ JSON مع طلب تعديل: رجّع الموقع كله بعد التعديل بنفس الشكل، وغيّر بس اللي اتطلب وحافظ على الباقي (ومن غير ما تلمس حقول src).`;
  }
  if (task === 'storyboard') {
    return `${base}
مهمتك دلوقتي: إنت مخرج فيديوهات خيالية في «استوديو شاهين». حوّل فكرة المستخدم لقصة مصوّرة من 3 لـ 10 مشاهد. رد بـ JSON بس (من غير أي كلام قبله أو بعده) بالشكل:
{"title":"عنوان الفيديو","scenes":[{"caption":"جملة قصيرة تظهر على الشاشة بلغة المستخدم","prompt":"detailed English description of the picture for this scene, same characters and style across scenes","seconds":4,"motion":"zoom-in|zoom-out|pan-left|pan-right|pan-up|still","effect":"none|rain|snow|embers|stars|dust|fog|sparkles|light"}]}
خلي المشاهد ليها بداية ووسط ونهاية، والوصف الإنجليزي محدد (المكان، الإضاءة، زاوية الكاميرا، الشخصيات بنفس الشكل في كل مشهد). الجمل على الشاشة قصيرة (أقل من 12 كلمة). نوّع اللقطات زي المخرجين: لقطة واسعة (wide shot) في الأول، متوسطة في النص، وقريبة (close-up) في اللحظة الكبيرة. و effect هو جو المشهد (مطر، تلج، شرار نار، نجوم، غبار، ضباب، لمعة سحرية، أشعة شمس) أو none.`;
  }
  if (task === 'graphic') {
    return `${base}
مهمتك دلوقتي: إنت مصمم جرافيك ومعلن محترف في «استوديو شاهين». حوّل طلب المستخدم لتصميم (بوست، ستوري، غلاف، بوستر، كارت…). رد بـ JSON بس (من غير أي كلام قبله أو بعده) بالشكل:
{"format":"post|story|x|yt|fb_cover|banner|poster|card","layout":"center|split|band|frame|bold|minimal","bg":"gradient|solid|pattern|image","base":"#8a5a2b","harmony":"complementary|analogous|triadic|split|mono","dark":false,"font":"cairo|tajawal|amiri|reem|playfair|poppins|serif|grotesk","headline":"عنوان قصير قوي (أقل من 8 كلمات)","sub":"جملة أو جملتين بتشرح","cta":"كلمتين للزرار أو فاضي","footer":"تليفون/موقع/عنوان المستخدم لو إداه، وإلا فاضي","imagePrompt":"English description of a background photo with calm empty space for text, no text in the image"}
اكتب الكلام بلغة المستخدم وبأسلوب إعلاني جذاب ومختصر. ما تخترعش أسعار أو خصومات أو تواريخ أو أرقام تليفون مش موجودة في الطلب. اختار المقاس من المنصة اللي ذكرها (ستوري للستوري والريلز، yt لصورة يوتيوب…) والألوان والخط اللي يناسبوا الهوية.`;
  }
  if (task === 'block') {
    return `${base}
مهمتك دلوقتي: إنت مطوّر واجهات محترف في «استوديو شاهين». اكتب «بلوك» واحد لصفحة ويب حسب الطلب: HTML نضيف ومتجاوب جوّه سياج \`\`\`html واحد، فيه <section class="sb"> و<div class="sb-in"> و<style> صغير خاص بيه في الأول.
استخدم متغيرات الألوان دي بس (من غير ألوان ثابتة): var(--p) الأساسي، var(--a) المكمّل، var(--bg) الخلفية، var(--sf) الكروت، var(--tx) الكلام، var(--mu) الكلام الخفيف، var(--on) الكلام على الأساسي، var(--r) الحواف. والكلاسات الجاهزة: sb-title للعنوان، sb-btn للزرار (وsb-btn ghost للزرار المفرّغ)، sb-card للكارت، sb-grid للشبكة، sb-field للخانات.
ممنوع <script> أو onclick أو أي JavaScript، وممنوع روابط أو صور خارجية (استخدم <div class="sb-ph"> مكان الصورة). الكلام بلغة المستخدم واتجاهه مظبوط، ومن غير أسعار أو آراء أو أرقام مخترعة (حط 000 أو «اكتب هنا…»). خلي الكلاسات الجديدة كلها تبدأ بـ sb-.`;
  }
  if (task === 'bot') {
    return `${base}
مهمتك دلوقتي: إنت مصمم روبوتات محادثة في «استوديو شاهين». صمّم روبوت محادثة لموقع المستخدم حسب وصفه. رد بـ JSON بس (من غير أي كلام قبله أو بعده) بالشكل:
{"name":"اسم قصير","avatar":"إيموجي واحد","color":"#8a5a2b","kind":"support|sales|booking|faq|tutor|custom","tone":"friendly|formal|fun|expert","role":"وظيفته في جملة","greeting":"أول رسالة","rules":["قاعدة"],"quick":["زرار سريع"],"faq":[{"q":"السؤال بكذا صيغة يقولها الناس","a":"الإجابة"}],"collect":{"trigger":"كلمات تبدأ الحجز أو الطلب مفصولة بفاصلة","fields":[{"label":"السؤال اللي يسأله","kind":"text|phone|email|date"}],"done":"جملة بعد ما يخلص"},"handoff":{"whatsapp":"رقم المستخدم بكود الدولة أرقام بس لو إداه","email":"إيميله لو إداه"}}
الكلام بلغة المستخدم ولهجته. من 3 لـ 10 أسئلة، و«q» فيه الكلمات اللي الناس فعلاً بتكتبها (مثلاً: «بكام / السعر كام / الأسعار»). أي معلومة مش في الوصف (أسعار، مواعيد، عنوان، سياسات) خلي إجابتها «اكتب هنا …» بدل ما تخترعها. ما تخترعش أرقام تليفون أو إيميلات.`;
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

/**
 * «بحث جوجل عند الاحتياج»: Google is opened for questions that need facts. Not for a greeting or thanks, code,
 * creative writing or feelings — searching there only adds seconds before the first word.
 */
const SMALL_TALK = /^(?:(?:يا\s*)?(?:اهلا|أهلا|اهلين|هلا|مرحبا|السلام عليكم|سلام|صباح الخير|مساء الخير|صباح النور|مساء النور|ازيك|إزيك|ازيكم|عامل ايه|عامل إيه|اخبارك|أخبارك|شكرا|شكراً|متشكر|تسلم|تمام|ماشي|اوك|أوك|حلو|جميل|برافو|تمام كده|hi|hello|hey|thanks|thank you|ok|okay|good morning|good evening|great|cool)(?:\s*(?:يا\s*)?(?:شاهين|صاحبي|باشا|معلم|حبيبي|يا))?[\s.!?؟،,]*)+$/iu;
export function googleHelps(text: string, profile = profileQuestion(text)): boolean {
  const t = text.normalize('NFC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').trim();
  if (!t || SMALL_TALK.test(t)) return false;
  return !(['code', 'creative', 'feelings'] as const).includes(profile.kind as 'code');
}

// ── Web search ──────────────────────────────────────────────────────────────────────────────────────────────
export interface SearchResult { title: string; url: string; snippet: string }
/** Gemini models tried in turn for a Google search (a model whose own quota or access refuses the search tool → the next). */
export const GOOGLE_SEARCH_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'] as const;
/** Inside the chat's own wait for a search (LIVE_SEARCH_MS, 18 s). */
const GOOGLE_SEARCH_BUDGET_MS = 16_000;

export async function webSearch(query: string, language: SupportedLanguage, { env, fetch: request = fetch, live = false, googleOnly = false }: { env: Env; fetch?: typeof fetch;
  /** About today (news, prices): the encyclopedia is never offered as an answer — it has no today. */
  live?: boolean; googleOnly?: boolean }): Promise<{ answer?: string; results: SearchResult[]; kind: 'web' | 'encyclopedia' }> {
  const q = query.trim().slice(0, 300);
  // 1) «بحث جوجل»: the AI platform's own Google search (its answer with the pages it used), model after model.
  if (env.GEMINI_API_KEY?.trim() && env.SHAM_WORKSPACE_WEB_SEARCH?.trim().toLowerCase() !== 'off') {
    const started = Date.now();
    // The fast model first (it searched and answered in ~1.5-5 s when measured); the rolling alias last (20 a day, may hang).
    const models = [...new Set([env.GEMINI_SEARCH_MODEL?.trim() || GOOGLE_SEARCH_MODELS[0], ...GOOGLE_SEARCH_MODELS, GEMINI_DEFAULT_MODEL])];
    for (const model of models) {
      const left = GOOGLE_SEARCH_BUDGET_MS - (Date.now() - started);
      if (left < 3000) break;
      try {
        const response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: AbortSignal.timeout(Math.min(10_000, left)),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY.trim() },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${q}\n\n(${language === 'ar' ? 'دوّر في جوجل وجاوب بالعربي باختصار ومن نتايج البحث بس' : `Search Google and answer briefly in ${language}, from the search results only`})` }] }], tools: [{ google_search: {} }] }),
        });
        if (!response.ok) {
          googleHealth.fail(model, response.status, failureDetail(await response.text().catch(() => '')), 'search');
          if (response.status === 401) break; // a wrong key: no other model will do better
          continue;
        }
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; groundingMetadata?: unknown }> };
        const candidate = data.candidates?.[0];
        const answer = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
        const results = groundingSources(candidate?.groundingMetadata).map((r) => ({ ...r, snippet: '' })).slice(0, 8);
        if (answer && (results.length || googleOnly)) { googleHealth.ok(model, 'search'); return { answer, results, kind: 'web' }; }
        googleHealth.fail(model, 200, 'NO_GROUNDING', 'search');
      } catch (error) {
        const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
        googleHealth.fail(model, timedOut ? 408 : 0, timedOut ? 'TIMEOUT' : 'UNREACHABLE', 'search');
        // A stuck model is not a spent budget: the loop tries the next one while at least 3 s are left.
        if (!timedOut) continue;
      }
    }
  }
  if (googleOnly) return { results: [], kind: 'web' };
  // 2) A live-search platform, when one is connected.
  const statuses = engineStatuses(env);
  if (!googleOnly && statuses.find((s) => s.id === 'perplexity')?.configured) {
    try {
      let sources: SearchResult[] = [];
      const answer = await callEngine('perplexity', 'Answer from current web results, briefly, with the sources you used.', [{ role: 'user', text: q }], {
        env, fetch: request, signal: AbortSignal.timeout(25_000), temperature: 0.2, maxTokens: 900,
        onSources: (found) => { sources = found.map((s) => ({ title: s.title || s.url, url: s.url, snippet: '' })); },
      });
      if (answer && sources.length) return { answer, results: sources.slice(0, 8), kind: 'web' };
    } catch { /* falls through */ }
  }
  // 3) The free encyclopedia API (no key, official) — never for today's news (Bahrain 2011 is not today's news).
  if (live) return { results: [], kind: 'encyclopedia' };
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
/** Why no image came back — each reason has its own honest message for the visitor (never one vague «failed»). */
export type ImageFailure = 'no_engine' | 'quota' | 'refused' | 'rejected' | 'unreachable';
export type ImageResult = { image: string; model: string } | { failure: ImageFailure; status?: number; detail?: string };
const IMAGE_MODEL = 'gemini-2.5-flash-image';
/** An image model found on the account after the configured one was retired (kept for an hour, per key). */
const foundModels = new Map<string, { model: string; at: number }>();
const keyTag = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 12);

/** The account's own list: a model that draws through generateContent, the light «flash» ones first. */
async function findImageModel(key: string, not: string, request: typeof fetch): Promise<string | undefined> {
  const kept = foundModels.get(keyTag(key));
  if (kept && kept.model !== not && Date.now() - kept.at < 60 * 60_000) return kept.model;
  try {
    const response = await request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { signal: AbortSignal.timeout(10_000), headers: { 'x-goog-api-key': key } });
    if (!response.ok) return undefined;
    const data = await response.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const names = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name || '').replace(/^models\//, ''))
      .filter((id) => /^gemini-/.test(id) && /image/i.test(id) && id !== not)
      .sort((x, y) => Number(/flash/i.test(y)) - Number(/flash/i.test(x)) || Number(/preview|exp/i.test(x)) - Number(/preview|exp/i.test(y)) || y.localeCompare(x));
    if (names[0]) foundModels.set(keyTag(key), { model: names[0], at: Date.now() });
    return names[0];
  } catch { return undefined; }
}

/**
 * «خيال شاهين» (src/utils/imageCraft.ts) art-directs the idea first; the engine then draws the brief.
 * A new image may carry a frame shape; an edit keeps the shape of the image it was given. When the
 * configured model is gone (404) the account's own model list is asked once for another that draws.
 */
export async function drawImage(prompt: string, image: string | undefined, { env, fetch: request = fetch, style, aspect }: { env: Env; fetch?: typeof fetch; style?: ImageStyleId; aspect?: ImageAspect }): Promise<ImageResult> {
  if (wantsRealPhoto(prompt)) throw new ReadError(400, 'REAL_PHOTO_REQUIRES_SEARCH', 'Use image search for real photographs');
  const key = env.GEMINI_API_KEY?.trim();
  if (!key || env.SHAM_WORKSPACE_IMAGES?.trim().toLowerCase() === 'off') return { failure: 'no_engine' };
  const inline = image?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  const brief = inline ? { prompt: craftEditPrompt(prompt), aspect: undefined } : craftImagePrompt(prompt, { style, aspect });
  const parts: object[] = [{ text: brief.prompt.slice(0, 3600) + '\nDo not add AI vendor names, provider credits, or fake provenance text. The site adds its own sharing ai signature afterward. Preserve any existing embedded provenance or rights marks when editing.' }];
  if (inline) parts.push({ inlineData: { mimeType: inline[1], data: inline[2] } });
  const draw = (model: string, shape?: ImageAspect) => request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(45_000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(shape ? { imageConfig: { aspectRatio: shape } } : {}) } }),
  });
  const attempt = async (model: string): Promise<ImageResult> => {
    let response = await draw(model, brief.aspect);
    // An image model that does not take a frame shape rejects the field (400, no quota used): the brief
    // still names the ratio in words, so draw once more without the field.
    if (response.status === 400 && brief.aspect) response = await draw(model);
    if (!response.ok) {
      // The provider's own reason is for the server log only (it never holds the key).
      const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      return { failure: response.status === 429 ? 'quota' : response.status >= 500 ? 'unreachable' : 'rejected', status: response.status, ...(detail ? { detail } : {}) };
    }
    const data = await response.json() as { promptFeedback?: { blockReason?: string }; candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
    const out = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (out?.data) return { image: `data:${out.mimeType || 'image/png'};base64,${out.data}`, model };
    // Answered, but with words only or a safety stop: the engine declined this picture.
    return { failure: 'refused', status: 200, detail: data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'no image part' };
  };
  try {
    const model = env.GEMINI_IMAGE_MODEL?.trim() || IMAGE_MODEL;
    const first = await attempt(model);
    if ('image' in first || first.status !== 404) return first;
    const other = await findImageModel(key, model, request);
    return other ? await attempt(other) : first;
  } catch (error) {
    return { failure: 'unreachable', detail: error instanceof Error ? error.name : 'error' };
  }
}

/** The image alone (undefined when none came back) — for callers that do not need the reason. */
export async function makeImage(prompt: string, image: string | undefined, options: { env: Env; fetch?: typeof fetch; style?: ImageStyleId; aspect?: ImageAspect }): Promise<string | undefined> {
  const result = await drawImage(prompt, image, options);
  return 'image' in result ? result.image : undefined;
}

/** What the visitor's browser is told for each reason (codes only — the provider's words stay in the log). */
export const IMAGE_FAILURE_RESPONSE: Record<ImageFailure, { status: number; code: string }> = {
  no_engine: { status: 503, code: 'NO_IMAGE_ENGINE' },
  quota: { status: 503, code: 'IMAGE_QUOTA' },
  refused: { status: 422, code: 'IMAGE_REFUSED' },
  rejected: { status: 502, code: 'IMAGE_ENGINE_REJECTED' },
  unreachable: { status: 502, code: 'IMAGE_ENGINE_UNREACHABLE' },
};

// ── The conversation ────────────────────────────────────────────────────────────────────────────────────────
interface AskBody { messages?: unknown; language?: unknown; task?: unknown; context?: unknown; search?: unknown; deep?: unknown }
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

/**
 * A question whose honest answer changes by the day — news, prices, weather, scores, «النهارده», «آخر» — is
 * answered from a live web search even when the visitor did not press the web button.
 */
function normalizedQuery(text: string) {
  return text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
}

/** Current clock/date questions must be grounded in Google Search, never a visitor device clock or server guess. */
export function asksCurrentDateTime(text: string): boolean {
  const q = normalizedQuery(text);
  return /(?:الوقت\s*و\s*التاريخ|(?:الوقت|الساعه).{0,14}(?:دلوقتي|حاليا|الان|كام|الحالي)|(?:كام|كم|ايه).{0,10}(?:الساعه|التاريخ)|(?:تاريخ|التاريخ).{0,12}(?:اليوم|النهارده|النهارده)|(?:اليوم|النهارده).{0,10}(?:كام|تاريخ)|\b(?:what time is it|what(?:'s| is) the time|current time|time now|today'?s date|current date|date today|what date is it)\b)/i.test(q);
}

/** Default an unqualified clock question to Sham's Cairo locale; keep an explicitly named place untouched. */
export function dateTimeSearchQuery(text: string, language: SupportedLanguage = 'ar'): string {
  const q = text.trim().slice(0, 260);
  const hasPlace = /\bin\s+(?!the\b)[\p{L}][\p{L}\s-]{1,40}/iu.test(q)
    || /\b(?:in|at)\s+the\s+(?:time\s+zone|city\s+of)\b/i.test(q)
    || /في\s+(?!الوقت|التاريخ|اليوم|النهارده|النهارده|الساعه|حاليا|دلوقتي)\S+/u.test(q)
    || /بتوقيت\s+\S+/u.test(q);
  if (hasPlace) return q;
  if (language === 'ar') return `${q} — الوقت والتاريخ الحاليان في القاهرة، مصر`;
  return `${q} — current local time and date in Cairo, Egypt`;
}

export function wantsLiveInfo(text: string): boolean {
  const q = normalizedQuery(text);
  if (q.length > 600) return false; // a long paste is a document to work on, not a question about today
  if (asksCurrentDateTime(q)) return true;
  return /اخبار|اخر (?:ال)?(?:مستجدات|تطورات|اخبار|اسعار|سعر)|مستجدات|تطورات|عاجل|حصل ايه|ايه اللي حصل|ماذا حدث|(?:ال)?(?:وضع|اوضاع) (?:في|فى)|هدنه|انتخابات|زلزال|سعر (?:ال)?(?:دولار|يورو|ذهب|دهب|جنيه|ريال|درهم|بترول|نفط|بنزين|بيتكوين|فضه)|اسعار (?:ال)?(?:ذهب|دهب|عملات|صرف|نفط|بترول)|بكام (?:ال)?(?:دولار|ذهب|دهب|يورو)|البورصه|(?:حاله )?(?:ال)?طقس|درجه الحراره|نتيجه (?:ال)?(?:مباراه|ماتش)|مباراه (?:اليوم|النهارده)|ماتش النهارده|مين (?:كسب|فاز)|\bnews\b|\bheadlines\b|\bbreaking\b|\blatest (?:on|news|update)|what(?:'s| is) happening|\bceasefire\b|\belection results?\b|\b(?:gold|oil|dollar|euro|bitcoin|stock) price|\bprice of (?:gold|oil|bitcoin)\b|\bexchange rate\b|\bweather\b|\bforecast\b|\bscore of\b|\bwho won\b/.test(q)
    || (/النهارده|انهارده|اليوم|دلوقتي|حاليا|الان |هذا الاسبوع|الاسبوع ده|\btoday\b|\bright now\b|\bcurrently\b|\bthis week\b|\btonight\b/.test(`${q} `) && /ايه|ما |ماذا|مين|من |كام|كم |هل |فين|اين|\?|؟|\bwhat\b|\bwho\b|\bhow much\b|\bis there\b|\bany\b/.test(`${q} `) && !/اكتب|ترجم|لخص|ارسم|صمم|\bwrite\b|\btranslate\b|\bdraw\b|\bsummar/.test(q));
}

export type AskFailure = EngineFailure | 'timeout' | 'unreachable' | 'empty';
/** Why every platform failed, as one honest code for the visitor (and one line in the server log for the owner). */
export function askFailureCode(failures: readonly { kind: AskFailure }[]): { status: number; code: string } {
  const all = (...kinds: AskFailure[]) => failures.length > 0 && failures.every((f) => kinds.includes(f.kind));
  if (all('rate_limited', 'no_credit')) return { status: 503, code: 'ENGINES_QUOTA' };
  if (all('timeout')) return { status: 504, code: 'ENGINES_TIMEOUT' };
  if (all('invalid_key', 'model_not_found', 'region_blocked', 'no_credit')) return { status: 503, code: 'ENGINES_MISCONFIGURED' };
  return { status: 503, code: 'ENGINES_BUSY' };
}
const RETRYABLE: readonly AskFailure[] = ['upstream_error', 'timeout', 'unreachable', 'empty', 'rate_limited'];

/** What a streamed turn reports while it is being written (POST /api/workspace/ask/stream). */
export type AskEvent =
  | { type: 'stage'; stage: 'searching' | 'writing' | 'thinking' | 'reviewing' }
  | { type: 'sources'; sources: SearchResult[] }
  | { type: 'delta'; text: string }
  /** The platform writing the reply failed midway: what was shown so far is dropped and another one starts over. */
  | { type: 'reset' };

export async function askWorkspace(body: AskBody, { env, fetch: request = fetch, signal, now = () => new Date(), retryDelayMs = 700, health, onEvent }: { env: Env; fetch?: typeof fetch; signal?: AbortSignal; now?: () => Date; retryDelayMs?: number; health?: EngineHealth; onEvent?: (event: AskEvent) => void }): Promise<{ reply: string; sources: SearchResult[]; via?: 'search' }> {
  const language = languageOf(body.language);
  const task: WorkspaceTask = (['plan', 'summarize', 'site', 'storyboard', 'graphic', 'block', 'bot', 'blocks'] as const).find((t) => t === body.task) || 'chat';
  // The design tasks arrive whole too (a JSON, or one fenced block of HTML).
  const json = task === 'plan' || task === 'site' || task === 'storyboard' || task === 'graphic' || task === 'block' || task === 'bot' || task === 'blocks';
  const rawTurns = askTurns({ ...body, context: [] }, false);
  const latest = rawTurns[rawTurns.length - 1]!;
  const blocksReply = task === 'chat' && !(Array.isArray(body.context) && body.context.length) && !body.search ? blockBuilderReply(latest.text, language) : undefined;
  if (blocksReply) return { reply: blocksReply, sources: [] };
  const photoReply = task === 'chat' ? realPhotoReply(latest.text, rawTurns.slice(0, -1), language) : undefined;
  if (photoReply) return { reply: photoReply, sources: [] };
  const turns = askTurns(body);
  let sources: SearchResult[] = [];
  let found: { results: SearchResult[]; answer?: string } = { results: [] };
  const lastQuestion = rawTurns[rawTurns.length - 1]!.text;
  const liveClock = task === 'chat' && asksCurrentDateTime(lastQuestion);
  const liveQuestion = task === 'chat' && (wantsLiveInfo(lastQuestion) || needsLiveWeb(lastQuestion));
  if (liveClock || body.search === true || (body.search !== false && liveQuestion)) {
    onEvent?.({ type: 'stage', stage: 'searching' });
    const searchTurns = askTurns({ ...body, context: [] }, false);
    const latest = searchTurns[searchTurns.length - 1]!.text;
    const focus = conversationFocus(latest, searchTurns.slice(0, -1));
    const asked = (focus ? `${focus.question} — ${latest}` : latest).slice(0, 300);
    const searchQuery = liveClock ? dateTimeSearchQuery(asked, language) : asked;
    // Never search a contextless 'show me pictures' or a JSON context wrapper. Clock/date questions are Google-only.
    found = isContextFollowUp(latest) && !focus ? { results: [] as SearchResult[], answer: undefined }
      : await webSearch(searchQuery, language, { env, fetch: request, live: liveQuestion, googleOnly: liveClock }).catch(() => ({ results: [] as SearchResult[], answer: undefined }));
    if (liveClock && !found.answer?.trim()) {
      const reply = language === 'ar'
        ? 'مش قادر أوصل لبحث Google دلوقتي علشان أتحقق من الوقت والتاريخ، فمش هخمّنهم. جرّب تاني بعد شوية.'
        : 'I can’t reach Google Search right now to verify the current time and date, so I won’t guess. Please try again shortly.';
      return { reply, sources: [] };
    }
    sources = found.results;
    if (sources.length) {
      const list = sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}${s.snippet ? `\n${s.snippet}` : ''}`).join('\n');
      const last = turns[turns.length - 1]!;
      turns[turns.length - 1] = { role: 'user', text: `نتايج بحث ويب لسه طالعة:\n${list}${found.answer ? `\n\nملخص البحث: ${found.answer.slice(0, 4000)}` : ''}\n\n---\n\n${last.text}` };
    }
  }
  if (sources.length) onEvent?.({ type: 'sources', sources });
  if (liveClock && found.answer?.trim()) return { reply: found.answer.trim().slice(0, 6000), sources, via: 'search' };
  // What a live search already answered is never thrown away because the writing platforms are down.
  const fromSearch = (): { reply: string; sources: SearchResult[]; via: 'search' } | undefined => {
    if (found.answer?.trim() && (sources.length || liveClock)) return { reply: found.answer.trim().slice(0, 6000), sources, via: 'search' };
    // No written summary, but real pages were found: show them as they are rather than an error.
    if (sources.length) return { reply: sources.slice(0, 5).map((r, i) => `**[${i + 1}] ${r.title}**\n${r.snippet}`.trim()).join('\n\n'), sources, via: 'search' };
    return undefined;
  };
  // The shared health record (the one the admin panel shows): platforms known to be down are tried last.
  const engines = health ? health.order(configuredEngines(env)) : configuredEngines(env);
  if (!engines.length) { const answered = fromSearch(); if (answered) return answered; throw new ReadError(503, 'NO_ENGINE', 'No AI platform is open right now'); }
  const today = now().toISOString().slice(0, 10);
  // «عقل شاهين»: the habits of a careful expert, and the shape this kind of question needs (src/utils/thinkingCraft.ts).
  const profile = profileQuestion(lastQuestion, rawTurns.length > 1);
  const craft = task === 'chat' ? `\n${THINKING_CRAFT_INSTRUCTION}${thinkingHint(profile) ? `\n${thinkingHint(profile)}` : ''}` : '';
  const deep = body.deep === true && task === 'chat';
  const system = `${workspaceInstruction(language, task)}${craft}\nتاريخ النهارده ${today}. لو السؤال عن حاجة بتتغير مع الوقت (أخبار، أسعار، طقس، نتايج، مناصب) ومفيش نتايج بحث ويب قدامك في الرسالة ومقدرتش تدوّر في جوجل بنفسك، قول بصراحة في أول سطر إن معلوماتك ممكن تكون أقدم من النهارده، وبعدها اشرح الخلفية اللي تعرفها من غير ما تخترع أحداث أو أرقام جديدة.${task === 'chat' ? `${PRECISE_ANSWER_INSTRUCTION}${needInstruction(lastQuestion, { answered: rawTurns.some((turn) => turn.role === 'assistant') })}` : ''}`;
  const started = Date.now();
  let invalidTool = false;
  const failures: { id: string; kind: AskFailure; status?: number }[] = [];
  /** A whole answer from the first platform that gives one (no live writing): the private plan and the rewrite. */
  const quietCall = async (sys: string, quietTurns: EngineTurn[], maxTokens: number, timeoutMs: number, temperature: number): Promise<string | undefined> => {
    for (const id of engines) {
      if (signal?.aborted) return undefined;
      try {
        const out = await callEngine(id, sys, quietTurns, { env, fetch: request, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]), temperature, maxTokens, maxChars: 60_000, ...(id === 'gemini' ? { model: fastGeminiModel(env) } : {}) });
        if (typeof out === 'string' && out.trim()) { health?.ok(id); return out.trim(); }
      } catch { /* the next platform; a failed extra pass never fails the answer */ }
    }
    return undefined;
  };
  // «فكّر بعمق»: a private outline first (what is really asked, the facts, the steps, the traps, the shape)…
  if (deep) {
    onEvent?.({ type: 'stage', stage: 'thinking' });
    const plan = await quietCall(`${workspaceInstruction(language, 'chat')}\n${DEEP_PLAN_INSTRUCTION}\nتاريخ النهارده ${today}.`, turns, 900, 22_000, 0.3);
    if (plan) { const last = turns[turns.length - 1]!; turns[turns.length - 1] = { ...last, text: withPlan(last.text, plan) }; }
  }
  // …and after writing, the checklist: small slips mended here, real ones rewritten once in deep mode.
  const finalize = async (reply: string): Promise<string> => {
    if (task !== 'chat') return reply;
    const notes = reviewReply(lastQuestion, reply, profile);
    const mended = fixReply(reply);
    if (!deep || !needsRevision(notes) || signal?.aborted || Date.now() - started > 40_000) return mended;
    onEvent?.({ type: 'stage', stage: 'reviewing' });
    const rewritten = await quietCall(system, [{ role: 'user', text: revisionRequest(lastQuestion, reply, notes) }], 6000, 30_000, 0.4);
    if (!rewritten) return mended;
    const better = fixReply(polishReply(rewritten).trim() || rewritten);
    const left = reviewReply(lastQuestion, better, profile).filter((n) => n.severity === 'revise').length;
    if (left >= notes.filter((n) => n.severity === 'revise').length) return mended;
    if (live) { onEvent?.({ type: 'reset' }); onEvent?.({ type: 'stage', stage: 'writing' }); onEvent?.({ type: 'delta', text: better }); }
    return better;
  };
  // Chat and summaries are written live, letter by letter; the JSON tasks arrive whole (half a JSON is no use).
  const live = Boolean(onEvent) && !json;
  const finish = (reply: string) => (json ? reply : polishReply(reply).trim() || reply);
  const tryEngine = async (id: (typeof engines)[number], timeoutMs: number, { plain = false }: { plain?: boolean } = {}): Promise<string | undefined> => {
    let failed: { kind: EngineFailure; status?: number } | undefined;
    let sent = false;
    const dropped = () => { if (sent) { sent = false; onEvent?.({ type: 'reset' }); } };
    try {
      const reply = await callEngine(id, system, turns, {
        env, fetch: request, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]),
        // «سرعة شاهين»: everyday answers start on the fast model; «فكّر بعمق» keeps the strongest one.
        ...(id === 'gemini' && !deep ? { model: fastGeminiModel(env) } : {}),
        temperature: task === 'plan' ? 0.2 : json ? 0.5 : plain ? 0.4 : 0.6, maxTokens: task === 'plan' ? 1200 : task === 'graphic' ? 900 : task === 'storyboard' || task === 'bot' ? 2500 : task === 'site' ? 8000 : 6000, maxChars: 60_000,
        onFailure: (kind, status) => { failed = { kind, status }; },
        // «بحث جوجل»: in a chat, Gemini searches Google itself whenever the answer needs it.
        ...(task === 'chat' && !plain && (googleHelps(lastQuestion, profile) || liveQuestion || body.search === true) ? { googleSearch: true, onSources: (found: { title: string; url: string }[]) => {
          for (const f of found) if (!sources.some((x) => x.url === f.url)) sources.push({ ...f, snippet: '' });
          onEvent?.({ type: 'sources', sources });
        } } : {}),
        ...(live ? { onToken: (text: string) => { if (!sent) { sent = true; onEvent?.({ type: 'stage', stage: 'writing' }); } onEvent?.({ type: 'delta', text }); } } : {}),
      });
      if (typeof reply === 'string' && reply.trim()) {
        if (task === 'blocks') {
          try {
            const raw = reply.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
            const tool = parseToolSpec(raw);
            if (!runTool(tool).ok) throw new Error('DEFAULT_RUN_FAILED');
            health?.ok(id);
            return `\`\`\`json\n${JSON.stringify(tool, null, 2)}\n\`\`\``;
          } catch { invalidTool = true; return undefined; }
        }
        health?.ok(id); return finish(reply.trim());
      }
      dropped();
      failures.push({ id, ...(failed || { kind: 'empty' as const }) });
      health?.fail(id, failed?.kind || 'empty');
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      dropped();
      const timedOut = name === 'TimeoutError' || name === 'AbortError';
      failures.push({ id, kind: timedOut ? 'timeout' : 'unreachable' });
      if (!signal?.aborted) health?.fail(id, timedOut ? 'timeout' : 'upstream_error');
    }
    return undefined;
  };
  for (const id of engines) {
    if (signal?.aborted) break;
    const reply = await tryEngine(id, 45_000);
    if (reply) return { reply: await finalize(reply), sources };
    // An answer that went round in circles: once more right away, plainly (no search tool, a calmer temperature).
    if (failures.at(-1)?.id === id && failures.at(-1)?.kind === 'empty' && !signal?.aborted && Date.now() - started < 30_000) {
      const again = await tryEngine(id, 30_000, { plain: true });
      if (again) return { reply: await finalize(again), sources };
    }
  }
  // One more round for the platforms that only stumbled (overload, a slow answer, a per-minute limit) — while there is still time.
  const again = engines.filter((id) => failures.some((f) => f.id === id && RETRYABLE.includes(f.kind)));
  if (again.length && !signal?.aborted && Date.now() - started < 25_000) {
    if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    for (const id of again) {
      if (signal?.aborted || Date.now() - started > 50_000) break;
      const reply = await tryEngine(id, 20_000);
      if (reply) return { reply: await finalize(reply), sources };
    }
  }
  const answered = fromSearch();
  if (answered) return answered;
  if (failures.length) console.warn(`[workspace] ask: every platform failed — ${failures.map((f) => `${f.id}=${f.kind}${f.status ? `(${f.status})` : ''}`).join(' ')}`);
  if (invalidTool) throw new ReadError(422, 'INVALID_TOOL_DEFINITION', 'No valid executable block definition was produced');
  const { status, code } = askFailureCode(failures);
  throw new ReadError(status, code, 'The AI platforms could not answer, try again in a minute');
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
  const limits = { ask: new RateLimiter(30, 60_000), search: new RateLimiter(20, 60_000), read: new RateLimiter(20, 60_000), image: new RateLimiter(8, 60_000), vision: new RateLimiter(10, 60_000), owner: new RateLimiter(30, 60_000), video: new RateLimiter(3, 60 * 60_000), videoPoll: new RateLimiter(120, 60_000) };
  const budget = options.videoBudget || new DailyBudget();
  const fail = (res: express.Response, error: unknown) => {
    if (error instanceof VideoError && error.detail) console.warn(`[workspace] video engine: ${error.code} ${error.detail}`);
    if (error instanceof ReadError || error instanceof VideoError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
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
      video: videoAccess(env), videoLeft: videoAccess(env) === 'off' ? 0 : budget.left(dailyLimit(env)),
    });
  });
  // The same turn, written live: stages, sources, then the reply in pieces, then the final (polished) reply.
  router.post('/ask/stream', limited('ask'), async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    const write = (event: object) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); };
    // A quiet line now and then keeps phones and proxies from closing a turn that is still thinking.
    const beat = setInterval(() => { if (!res.writableEnded) res.write(': keep\n\n'); }, 12_000);
    try {
      const output = await askWorkspace(req.body || {}, { env, fetch: request, signal: controller.signal, health: options.health, onEvent: write });
      write({ type: 'done', output });
    } catch (error) {
      if (error instanceof ReadError) write({ type: 'error', status: error.status, code: error.code });
      else { console.error('[workspace]', error instanceof Error ? error.message : error); write({ type: 'error', status: 500, code: 'INTERNAL' }); }
    } finally { clearInterval(beat); res.end(); }
  });
  router.post('/ask', limited('ask'), async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    try { res.json(await askWorkspace(req.body || {}, { env, fetch: request, signal: controller.signal, health: options.health })); } catch (error) { fail(res, error); }
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
      const result = await drawImage(prompt, typeof req.body?.image === 'string' ? req.body.image : undefined, {
        env, fetch: request,
        ...(isImageStyle(req.body?.style) ? { style: req.body.style } : {}), ...(isImageAspect(req.body?.aspect) ? { aspect: req.body.aspect } : {}),
      });
      if ('image' in result) { res.json({ image: result.image }); return; }
      const told = IMAGE_FAILURE_RESPONSE[result.failure];
      if (result.failure !== 'no_engine') console.warn(`[workspace] image engine: ${told.code} status=${result.status ?? '-'} ${result.detail || ''}`.trim());
      res.status(told.status).json({ error: 'No image', code: told.code });
    } catch (error) { fail(res, error); }
  });

  // «شاهين يقرا الصور»: the words in a visitor's picture and what it shows (nothing kept; the chat answers after).
  router.post('/read-image', limited('vision'), async (req, res) => {
    try { res.json(await readImage(req.body?.image, languageOf(req.body?.language), { env, fetch: request })); }
    catch (error) {
      if (error instanceof ImageReadError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
      fail(res, error);
    }
  });

  // The owner only: his Notion and Slack (the keys never leave the server).
  const digest = (v: string) => createHash('sha256').update(v).digest();
  const owner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = adminSecret(env);
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token.length < 12) { res.status(503).json({ error: 'Admin is disabled', code: 'ADMIN_NOT_CONFIGURED' }); return; }
    if (!provided || !timingSafeEqual(digest(provided), digest(token))) { res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }); return; }
    next();
  };
  // The professional video engine: owner-only or everyone (the owner decides), a daily budget, signed jobs.
  const signedIn = (req: express.Request) => {
    const token = adminSecret(env);
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return token.length >= 12 && Boolean(provided) && timingSafeEqual(digest(provided), digest(token));
  };
  router.post('/video/start', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const access = videoAccess(env);
    if (access === 'off') { res.status(503).json({ error: 'The professional video engine is off', code: 'NO_VIDEO_ENGINE' }); return; }
    const isOwner = signedIn(req);
    if (access === 'owner' && !isOwner) { res.status(403).json({ error: 'Owner only', code: 'VIDEO_OWNER_ONLY' }); return; }
    let body;
    try { body = cleanVideoRequest(req.body); } catch (error) { fail(res, error); return; }
    if (!isOwner && !limits.video.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, wait a while', code: 'RATE_LIMITED' }); return; }
    if (!budget.take(dailyLimit(env))) { res.status(429).json({ error: 'Today’s videos are used up, come back tomorrow', code: 'VIDEO_DAILY_LIMIT' }); return; }
    try {
      const job = await startVideo(body, { env, fetch: request });
      res.json({ job: signJob(job.id, env), status: job.status });
    } catch (error) { budget.give(); fail(res, error); }
  });
  router.get('/video/status', limited('videoPoll'), async (req, res) => {
    const id = readJob(req.query.job, env);
    if (!id || videoAccess(env) === 'off') { res.status(404).json({ error: 'Unknown job', code: 'NOT_FOUND' }); return; }
    try { res.json({ status: (await videoStatus(id, { env, fetch: request })).status }); } catch (error) { fail(res, error); }
  });
  router.get('/video/file', limited('videoPoll'), async (req, res) => {
    const id = readJob(req.query.job, env);
    if (!id || videoAccess(env) === 'off') { res.status(404).json({ error: 'Unknown job', code: 'NOT_FOUND' }); return; }
    try {
      const { status, data } = await videoStatus(id, { env, fetch: request });
      if (status !== 'completed') { res.status(409).json({ error: 'Not ready', code: status === 'failed' ? 'VIDEO_FAILED' : 'VIDEO_NOT_READY' }); return; }
      const { mime, bytes } = await videoBytes(data, { env, fetch: request });
      res.setHeader('Content-Type', /^video\/(?:mp4|webm)$/.test(mime) ? mime : 'video/mp4');
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      // In pieces: big clips are streamed rather than sent as one response.
      for (let at = 0; at < bytes.length; at += 512 * 1024) res.write(bytes.subarray(at, at + 512 * 1024));
      res.end();
    } catch (error) { fail(res, error); }
  });
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
