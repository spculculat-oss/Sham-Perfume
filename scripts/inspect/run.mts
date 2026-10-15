/**
 * Live inspection of Shaheen's answers, mode by mode, exactly as the GitHub Pages site receives and
 * renders them: the reply is parsed with the site's own code (formula toolbar, calculator links,
 * hidden machine blocks) and every visible problem is reported as a GitHub annotation.
 * Usage: INSPECT_MODES=auto,fast,deep node --import tsx scripts/inspect/run.mts
 */
import { extractFormulasFromAIMessage, findFormulaBlocks } from '../../src/utils/aiFormulaExtractor';
import { linkTools } from '../../src/utils/shaheenTools';
import { stripFormulaBlock } from '../../src/components/ShaheenMarkdown';
import { extractMediaRequest, stripMediaBlock } from '../../src/utils/shaheenMedia';
import { stripOpeningGreeting } from '../../src/utils/shaheenText';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShaheenMarkdown } from '../../src/components/ShaheenMarkdown';

const SITE = process.env.DOCTOR_SITE_URL || 'https://sham-perfume-49bf.vercel.app';
const ORIGIN = 'https://spculculat-oss.github.io';
const MODES = (process.env.INSPECT_MODES || 'auto,fast,deep').split(',');
const VENDORS = /\b(gemini|google|openai|chat ?gpt|gpt-?\d|claude|anthropic|deepseek|openrouter|llama|qwen|mistral)\b|جيمي?ني|جوجل|شات ?جي|كلود|ديب ?سيك/i;
const QUESTIONS = [
  'صمم لي عطر شرقي بالعود والورد 50 مل تركيز EDP',
  'عايز أخفف كحول 96% إلى 70% وأعمل منه 1 لتر، أحط كام مية؟',
  'كام يوم أعتق عطر العود عشان يثبت؟',
];
const esc = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const mode of MODES) {
  for (const question of QUESTIONS) {
    const started = Date.now();
    let status = 0; let json: any = {}; let raw = '';
    try {
      const res = await fetch(`${SITE}/api/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ message: question, model: mode, language: 'ar', conversationHistory: [], visitorId: `inspect-${mode}-${Date.now()}` }),
        signal: AbortSignal.timeout(70_000),
      });
      status = res.status; raw = await res.text();
      try { json = JSON.parse(raw); } catch { /* not json */ }
    } catch (e) { raw = String(e); }
    const ms = Date.now() - started;
    const reply: string = typeof json.reply === 'string' ? json.reply : '';
    const shown = stripFormulaBlock(stripMediaBlock(reply));
    const formulas = extractFormulasFromAIMessage(stripMediaBlock(reply));
    const blocks = findFormulaBlocks(stripMediaBlock(reply));
    const links = linkTools({ question, answer: reply, formulas });
    const problems: string[] = [];
    if (status !== 200) problems.push(`HTTP ${status} ${json.code || ''}`);
    if (status === 200 && !reply.trim()) problems.push('رد فاضي');
    if (/```|~~~/.test(shown)) problems.push('سياج كود ظاهر للزائر');
    if (/"(pyramidNotes|concentrationPercent|tools|images|videos)"\s*:/.test(shown)) problems.push('JSON خام ظاهر للزائر');
    if (VENDORS.test(reply)) problems.push(`اسم مزوّد: ${reply.match(VENDORS)![0]}`);
    if (blocks.length && !formulas.length) problems.push(`كتلة تركيبة غير صالحة (${blocks.length}) — شريط الحاسبة لن يظهر`);
    if (/sham-formula|sham-tool|sham-media/i.test(shown)) problems.push('اسم سياج داخلي ظاهر');
    // What the visitor's browser actually shows (same cleaning + renderer as the chat).
    const visible = stripOpeningGreeting(stripMediaBlock(reply), question);
    const html = renderToStaticMarkup(createElement(ShaheenMarkdown, { text: visible }));
    const text = html.replace(/<[^>]+>/g, ' ');
    if (/\$\$|\\(frac|times|text|approx|cdot)\b/.test(text)) problems.push('LaTeX خام ظاهر للزائر');
    if (/(^|\s)\*\s/.test(text)) problems.push('نجمة قائمة ظاهرة كنص');
    if (/^\s*(أهلاً|مرحباً|أنا الخبير شاهين)/.test(text.slice(0, 80))) problems.push('بدأ بالترحيب/التعريف (بعد التنظيف)');
    if (/^\s*(أهلاً|مرحباً)/.test(reply.slice(0, 40))) problems.push('ملحوظة: الخادم ما زال يرحّب (النسخة المنشورة قديمة)');
    if (/\$[A-Z]_|\\(frac|times)\b/.test(reply)) problems.push('ملحوظة: الخادم ما زال يكتب LaTeX (العميل يحوّله)');
    if (/صمم|تركيبة|ركّب/.test(question) && !formulas.length) problems.push('طلب تركيبة بدون تركيبة — شريط الحاسبة لن يظهر');
    const meta = { mode, http: status, ms, replyMode: json.mode, keys: Object.keys(json), chars: reply.length, shownChars: shown.length,
      formulas: formulas.map((f) => `${f.title} ${f.concentrationPercent}% ${f.bottleVolumeMl}ml notes=${f.pyramidNotes.length} days=${f.macerationDays}`),
      blocks: blocks.length, tools: links.map((l) => JSON.stringify(l)), media: Boolean(extractMediaRequest(reply)), code: json.code };
    const level = problems.length ? 'warning' : 'notice';
    const body = `${JSON.stringify(meta)}\nمشاكل: ${problems.join(' | ') || 'لا شيء'}\n----- RAW REPLY -----\n${(reply || raw).slice(0, 6000)}`;
    console.log(`::${level} title=${mode} · ${question.slice(0, 40)}::${esc(body)}`);
    await wait(6000);
  }
}
