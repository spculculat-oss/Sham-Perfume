import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_STRINGS, dsText } from '../src/studio/designStrings';
import { BACKGROUNDS, FORMAT_IDS, FORMATS, LAYOUTS, cleanGraphic, fitText, graphicFromReply, graphicSvg, localGraphic, wrapText, type GraphicSpec } from '../src/studio/graphic';
import { BLOCK_IDS, baseCss, blockCode, blockFromReply, blocksFor, blocksPage, toReact, toVue, type BlockOptions } from '../src/studio/blocks';
import { BOT_KINDS, botDemoPage, botEngine, botEngineSource, botFromReply, botPrompt, botScript, botTemplate, cleanBot, localBot, type BotSpec, type BotState, type BotTurn } from '../src/studio/botDesigner';
import { contrastReport, designTokens, exportPalette, gradientCss, shades, shadowCss, shadowPresets, spacingScale, typeScale } from '../src/studio/designTools';
import { paletteFrom } from '../src/studio/palette';
import { workspaceInstruction } from '../server/workspace';

const TEN = ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa'] as const;
const VENDORS = /gemini|openai|chatgpt|gpt-|claude|anthropic|deepseek|google|llama|mistral|pollinations/i;

test('design words: every key in all ten main languages, no vendor names', () => {
  for (const [key, text] of Object.entries(DESIGN_STRINGS)) {
    for (const l of TEN) assert.ok((text as Record<string, string>)[l]?.trim(), `${key}.${l}`);
    assert.doesNotMatch(Object.values(text).join(' '), VENDORS, key);
  }
  assert.equal(dsText('en', 'st_bots'), 'Robot designer');
  assert.equal(dsText('ar', 'st_graphic'), 'تصميم جرافيك');
});

const BASE: GraphicSpec = { format: 'post', layout: 'center', bg: 'gradient', base: '#8a5a2b', harmony: 'analogous', dark: false, font: 'cairo', headline: 'عرض الافتتاح <يوم الخميس>', sub: 'خصم على كل العطور & هدايا', cta: 'اطلب الآن', footer: '01000000000', decor: true };

test('graphic: every size, layout and background draws a clean SVG with the words escaped', () => {
  for (const format of FORMAT_IDS) for (const layout of LAYOUTS) for (const bg of BACKGROUNDS) for (const dark of [false, true]) {
    const svg = graphicSvg({ ...BASE, format, layout, bg, dark, image: bg === 'image' ? 'data:image/png;base64,AAAA' : undefined });
    const { w, h } = FORMATS[format];
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${format} ${layout} ${bg}`);
    assert.match(svg, new RegExp(`viewBox="0 0 ${w} ${h}"`));
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${format} ${layout} ${bg}`);
    assert.doesNotMatch(svg, /<يوم|<script/);
    assert.match(svg, /&lt;يوم/);
    assert.match(svg, /الخميس&gt;/);
    assert.match(svg, /direction="rtl"/);
    if (bg === 'image') assert.match(svg, /<image href="data:image\/png;base64,AAAA"/);
  }
  const en = graphicSvg({ ...BASE, headline: 'Grand opening', sub: 'Thursday', font: 'poppins' });
  assert.doesNotMatch(en, /direction="rtl"/);
  assert.match(en, /Poppins/);
  // Embedded fonts go into a <style> for downloads.
  assert.match(graphicSvg(BASE, { fontCss: '@font-face{font-family:Cairo}' }), /<style>@font-face\{font-family:Cairo\}<\/style>/);
});

test('graphic: text wraps and shrinks to fit; anything unsafe is dropped', () => {
  assert.deepEqual(wrapText('one two three four five', 9), ['one two', 'three', 'four five']);
  assert.equal(wrapText('a b c d e f g h i j k l', 4, 2).length, 2);
  assert.ok(wrapText('a b c d e f g h i j k l', 4, 2)[1]!.endsWith('…'));
  const fit = fitText('A very long headline that will not fit at the start size at all', 900, 120, 30, 3);
  assert.ok(fit.size < 120 && fit.lines.length <= 3);
  const clean = cleanGraphic({ format: 'nope', layout: 'bold', base: 'red', image: 'javascript:alert(1)', headline: 'x'.repeat(500) }, BASE);
  assert.equal(clean.format, 'post');
  assert.equal(clean.layout, 'bold');
  assert.equal(clean.base, '#8a5a2b');
  assert.equal(clean.image, undefined);
  assert.equal(clean.headline.length, 120);
  const fromAi = graphicFromReply('```json\n{"format":"story","headline":"افتتاح شام","cta":"","bg":"image","imagePrompt":"perfume bottles"}\n```', BASE)!;
  assert.equal(fromAi.format, 'story');
  assert.equal(fromAi.cta, '');
  assert.equal(fromAi.imagePrompt, 'perfume bottles');
  assert.equal(graphicFromReply('no json here', BASE), undefined);
  const local = localGraphic('اعمل ستوري لعرض «افتتاح شام» يوم الخميس. هدايا لأول 10 عملاء. 01012345678', BASE);
  assert.equal(local.format, 'story');
  assert.equal(local.headline, 'افتتاح شام');
  assert.match(local.footer, /01012345678/);
});

const OPTS: BlockOptions = { brand: 'شام', base: '#8a5a2b', harmony: 'complementary', dark: false, radius: 'soft', font: 'cairo', rtl: true };

test('code blocks: every block, both directions, plain HTML/CSS with no script; a whole page; React and Vue', () => {
  for (const rtl of [true, false]) for (const id of BLOCK_IDS) {
    const { html, css } = blockCode(id, { ...OPTS, rtl, brand: rtl ? 'شام' : 'Sham' });
    assert.ok(html.length > 40 && css.length > 20, id);
    assert.doesNotMatch(html, /<script|javascript:|undefined/i, id);
    assert.doesNotMatch(html, /\$\{/, id);
    if (rtl) assert.match(html, /[\u0600-\u06FF]/, id); else assert.doesNotMatch(html, /[\u0600-\u06FF]/, id);
  }
  const page = blocksPage(['navbar', 'hero', 'pricing', 'faq', 'contact', 'footer'], OPTS);
  assert.match(page, /^<!doctype html>/);
  assert.match(page, /<html lang="ar" dir="rtl">/);
  assert.match(page, /--p:#[0-9a-f]{6}/);
  assert.match(page, /fonts\.googleapis\.com/);
  assert.equal((page.match(/<section/g) || []).length, 4);
  const code = blockCode('contact', OPTS);
  const react = toReact(code, OPTS, 'Contact');
  assert.match(react, /export default function Contact\(\)/);
  assert.match(react, /className="/);
  assert.doesNotMatch(react, /\sclass="|\sfor="|onsubmit=/);
  assert.match(react, /onSubmit=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(react, /<input [^>]*\/>/);
  const vue = toVue(code, OPTS);
  assert.match(vue, /<template>[\s\S]*@submit\.prevent[\s\S]*<\/template>/);
  assert.match(vue, /<style>[\s\S]*--p:/);
  // A brand with braces or tags cannot break JSX or the page.
  const odd = blockCode('navbar', { ...OPTS, brand: '{x}<b>' }).html;
  assert.match(odd, /&#123;x&#125;&lt;b&gt;/);
  assert.match(baseCss({ ...OPTS, radius: 'round' }), /--r:22px/);
});

test('code blocks: words pick blocks; an AI block is cleaned of scripts and handlers', () => {
  assert.deepEqual(blocksFor('عايز جدول أسعار وأسئلة شائعة وفورم تواصل'), ['pricing', 'faq', 'contact']);
  assert.deepEqual(blocksFor('a hero with a login form'), ['hero', 'login']);
  assert.deepEqual(blocksFor('zzz'), []);
  const block = blockFromReply('Here:\n```html\n<!doctype html><html><head><style>.sb-x{color:var(--p)}</style></head><body><section class="sb sb-x" onclick="steal()"><a href="javascript:alert(1)">x</a><script>alert(1)</script><form><input></form></section></body></html>\n```')!;
  assert.equal(block.css, '.sb-x{color:var(--p)}');
  assert.doesNotMatch(block.html, /script|onclick|javascript:|<html|<body|<style/i);
  assert.match(block.html, /<form onsubmit="event\.preventDefault\(\)">/);
  assert.equal(blockFromReply('no code'), undefined);
});

function chat(bot: BotSpec, messages: string[], run: (spec: BotSpec, msg: string, st: BotState | null) => BotTurn = botEngine) {
  let state: BotState | null = null;
  return messages.map((m) => { const turn = run(bot, m, state); state = turn.state; return turn; });
}

test('robot: books step by step, checks the phone, sends the summary to WhatsApp, and can be cancelled', () => {
  const bot = botTemplate('booking', true, 'سمايل');
  bot.handoff.whatsapp = '201012345678';
  const turns = chat(bot, ['', 'عايز احجز', 'أحمد', '123', '٠١٠١٢٣٤٥٦٧٨', 'السبت الساعة 5']);
  assert.match(turns[0]!.text, /سمايل/);
  assert.match(turns[1]!.text, /اسمك/);
  assert.match(turns[2]!.text, /تليفون/);
  assert.match(turns[3]!.text, /مش مظبوط/);
  assert.match(turns[4]!.text, /اليوم/);
  const done = turns[5]!;
  assert.match(done.text, /أحمد/);
  assert.match(done.text, /01012345678/);
  assert.match(done.link!, /^https:\/\/wa\.me\/201012345678\?text=/);
  assert.equal(done.state.step, -1);
  const cancelled = chat(bot, ['احجز', 'الغاء']);
  assert.equal(cancelled[1]!.state.step, -1);
  assert.match(cancelled[1]!.text, /اتلغى/);
});

test('robot: understands spelling variants and small typos, hands over to a person, and never guesses', () => {
  const bot = botTemplate('sales', true, 'شام');
  bot.faq = [{ q: 'الأسعار كام؟ بكام', a: 'الأسعار في صفحة المنتجات.' }, { q: 'التوصيل بياخد قد إيه؟ شحن', a: 'التوصيل من 2 لـ 4 أيام.' }];
  bot.handoff.email = 'team@example.com';
  assert.equal(botEngine(bot, 'الاسعار كام', null).text, 'الأسعار في صفحة المنتجات.');
  assert.equal(botEngine(bot, 'التوصبل بياخد كام يوم', null).text, 'التوصيل من 2 لـ 4 أيام.');
  const human = botEngine(bot, 'عايز اكلم موظف', null);
  assert.match(human.link!, /^mailto:team@example\.com\?subject=/);
  const unknown = botEngine(bot, 'بتحبوا الكورة؟', null);
  assert.equal(unknown.text, bot.texts.fallback);
  const en = botTemplate('faq', false, 'Sam');
  en.faq = [{ q: 'What are your opening hours?', a: '9 to 5.' }];
  assert.equal(botEngine(en, 'opening hour?', null).text, '9 to 5.');
  assert.equal(botEngine(en, 'hello', null).text, en.greeting);
});

test('robot: the downloaded script carries the same engine, safely, and runs on a page', () => {
  const bot = botTemplate('booking', true, 'نور</script><script>alert(1)</script>');
  bot.handoff.whatsapp = '201012345678';
  const script = botScript(bot);
  assert.doesNotMatch(script, /<\/script>/i);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|localStorage|document\.cookie|sendBeacon/);
  assert.doesNotThrow(() => new Function(script));
  // The engine inside the script answers exactly like the one here.
  const copied = new Function(`var __name = function (f) { return f; }; return (${botEngineSource()});`)() as typeof botEngine;
  const here = chat(bot, ['', 'احجز', 'منى', '01011112222', 'بكره']).map((t) => [t.text, t.link || '']);
  const there = chat(bot, ['', 'احجز', 'منى', '01011112222', 'بكره'], copied).map((t) => [t.text, t.link || '']);
  assert.deepEqual(there, here);
  // It builds the widget on a (tiny, fake) page without errors.
  const made: string[] = [];
  const el = () => ({ className: '', textContent: '', style: {}, dir: '', type: '', placeholder: '', maxLength: 0, href: '', target: '', rel: '', childNodes: [] as unknown[], scrollTop: 0, scrollHeight: 0, value: '',
    setAttribute() {}, appendChild(c: unknown) { this.childNodes.push(c); return c; }, classList: { toggle() {} }, focus() {}, onclick: null, onsubmit: null });
  const doc = { readyState: 'complete', head: el(), body: el(), createElement: (t: string) => { made.push(t); return el(); }, addEventListener() {} };
  const win: Record<string, unknown> = {};
  new Function('window', 'document', 'setTimeout', script)(win, doc, () => 0);
  assert.equal(win.__shaheenBot, true);
  assert.ok(made.includes('style') && made.includes('form') && made.includes('input'));
  const demo = botDemoPage(bot);
  assert.match(demo, /<html lang="ar" dir="rtl">/);
  assert.match(demo, /robot\.js/);
});

test('robot: templates, cleaning, the description and the AI reply', () => {
  for (const kind of BOT_KINDS) for (const rtl of [true, false]) {
    const b = botTemplate(kind, rtl, 'X');
    assert.ok(b.greeting && b.texts.fallback && b.handoff.label, `${kind} ${rtl}`);
    assert.match(botPrompt(b), rtl ? /وظيفتك/ : /Your job/);
  }
  const base = botTemplate('faq', true);
  const clean = cleanBot({ name: 'a'.repeat(99), color: 'red', handoff: { whatsapp: '+20 101-234', email: 'not an email' }, faq: [{ q: 'q', a: '' }, { q: 'سؤال', a: 'جواب' }], quick: ['1', '2', '3', '4', '5', '6', '7'] }, base);
  assert.equal(clean.name.length, 40);
  assert.equal(clean.color, base.color);
  assert.equal(clean.handoff.whatsapp, '20101234');
  assert.equal(clean.handoff.email, '');
  assert.deepEqual(clean.faq, [{ q: 'سؤال', a: 'جواب' }]);
  assert.equal(clean.quick.length, 6);
  const local = localBot('روبوت حجوزات لعيادة أسنان اسمها «سمايل» واتساب 01012345678', true);
  assert.equal(local.kind, 'booking');
  assert.equal(local.name, 'سمايل');
  assert.equal(local.handoff.whatsapp, '201012345678');
  assert.equal(localBot('a tutor bot for my maths lessons', false).kind, 'tutor');
  const ai = botFromReply('{"name":"Bloom","kind":"sales","greeting":"Hi!","faq":[{"q":"price","a":"See the shop."}],"collect":{"trigger":"order","fields":[{"label":"Your phone?","kind":"phone"}],"done":"Thanks"}}', botTemplate('custom', false))!;
  assert.equal(ai.kind, 'sales');
  assert.equal(ai.collect.fields[0]!.kind, 'phone');
  assert.equal(botEngine(ai, 'price?', null).text, 'See the shop.');
});

test('design tools: contrast, palette exports, shades, gradients, shadows, type and spacing scales', () => {
  const r = contrastReport('#000000', '#ffffff');
  assert.equal(r.ratio, 21);
  assert.ok(r.aa && r.aaa && r.aaLarge);
  assert.equal(contrastReport('#777777', '#888888').aa, false);
  const p = paletteFrom('#0e7490');
  assert.match(exportPalette(p, 'css'), /--color-primary: #[0-9a-f]{6};[\s\S]*--color-primary-500/);
  assert.match(exportPalette(p, 'tailwind'), /primary: \{\s+DEFAULT:/);
  assert.match(exportPalette(p, 'scss'), /^\$primary: #/);
  assert.ok(JSON.parse(exportPalette(p, 'json')).primaryScale['950']);
  const s = shades('#8a5a2b');
  assert.equal(Object.keys(s).length, 11);
  assert.ok(contrastReport(s[50], '#000000').ratio > contrastReport(s[950], '#000000').ratio);
  assert.equal(gradientCss({ kind: 'linear', angle: -45, colors: ['#ff0000', '#0000ff'] }), 'linear-gradient(315deg, #ff0000 0%, #0000ff 100%)');
  assert.match(gradientCss({ kind: 'radial', angle: 0, colors: ['#ff0000', '#00ff00', '#0000ff'] }), /^radial-gradient\(circle at center, #ff0000 0%, #00ff00 50%, #0000ff 100%\)$/);
  assert.match(shadowCss(shadowPresets('#8a5a2b').inset), /^inset 0px 2px 6px 0px rgba\(0, 0, 0, 0\.15\)$/);
  const steps = typeScale(16, 1.25);
  assert.equal(steps.find((x) => x.name === 'base')!.px, 16);
  assert.equal(steps.find((x) => x.name === 'lg')!.px, 20);
  assert.equal(spacingScale(4).find((x) => x.name === '4')!.px, 16);
  const tokens = designTokens('#8a5a2b');
  for (const v of ['--color-primary:', '--text-base:', '--space-4:', '--shadow-medium:', '--gradient-brand:']) assert.ok(tokens.includes(v), v);
});

test('the server knows the three design tasks, names no vendor, and forbids invented facts', () => {
  for (const task of ['graphic', 'block', 'bot'] as const) {
    const text = workspaceInstruction('ar', task);
    assert.doesNotMatch(text, VENDORS, task);
    assert.match(text, /تخترع/, task);
  }
  assert.match(workspaceInstruction('ar', 'graphic'), /"headline"/);
  assert.match(workspaceInstruction('ar', 'block'), /var\(--p\)/);
  assert.match(workspaceInstruction('ar', 'block'), /ممنوع <script>/);
  assert.match(workspaceInstruction('ar', 'bot'), /"faq"/);
  assert.match(workspaceInstruction('ar'), /تصميم روبوتات/);
});
