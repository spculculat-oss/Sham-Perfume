import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, paletteFrom, HARMONIES } from '../src/studio/palette';
import { briefToSpec, cleanSiteSpec, detectKind, jsonFrom, missingImages, nameFrom, safeImageSrc, safeLink, type SiteSpec } from '../src/studio/siteSpec';
import { esc, exportSite, renderPage, singleFile } from '../src/studio/siteRender';
import { openSite, zipSite } from '../src/studio/siteZip';
import { forAi, localEdit, siteFromReply } from '../src/studio/siteEdit';
import { initials, logoChoices, monogramSvg, sanitizeSvg } from '../src/studio/logo';
import { cameraAt, cleanStoryboard, coverRect, frameAt, localStoryboard, musicPlan, totalSeconds, visualPrompt, wrapLines } from '../src/studio/storyboard';
import { STUDIO_STRINGS, stText } from '../src/studio/studioStrings';
import { workspaceInstruction } from '../server/workspace';

const TEN = ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa'] as const;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('studio palette: every harmony, light and dark, keeps text readable', () => {
  for (const base of ['#8a5a2b', '#0e7490', '#fde047', '#111111', '#ffffff', '#be185d']) {
    for (const harmony of HARMONIES) for (const dark of [false, true]) {
      const p = paletteFrom(base, { harmony, dark });
      assert.ok(contrast(p.text, p.bg) >= 7, `${base} ${harmony} ${dark} text`);
      assert.ok(contrast(p.muted, p.bg) >= 4.5, `${base} ${harmony} ${dark} muted`);
      assert.ok(contrast(p.onPrimary, p.primary) >= 3, `${base} ${harmony} ${dark} button`);
    }
  }
});

test('studio site: a few words become a whole site, in the visitor’s language', () => {
  const ar = briefToSpec('عايز موقع لمطعم مشويات اسمه «الريف» في إسكندرية، الإيميل info@alreef.com');
  assert.equal(ar.name, 'الريف');
  assert.equal(ar.dir, 'rtl');
  assert.equal(ar.lang, 'ar');
  assert.deepEqual(ar.pages.map((p) => p.slug), ['index', 'about', 'contact']);
  assert.equal(ar.pages[2]!.sections[0]!.email, 'info@alreef.com');
  assert.ok(missingImages(ar).length >= 4, 'pictures to draw');
  const landing = briefToSpec('a landing page for my photography portfolio named Nour', { language: 'en' });
  assert.equal(landing.pages.length, 1);
  assert.equal(landing.dir, 'ltr');
  assert.equal(landing.name, 'Nour');
  assert.equal(detectKind('عيادة أسنان'), 'clinic');
  assert.equal(detectKind('متجر عطور وعود'), 'perfume');
  assert.equal(detectKind('كورسات برمجة للأطفال'), 'education');
  assert.equal(nameFrom('موقع باسم شام'), 'شام');
});

test('studio site: anything from outside is cleaned (links, pictures, logo)', () => {
  assert.equal(safeLink('javascript:alert(1)'), '');
  assert.equal(safeLink('http://insecure.example'), '');
  assert.equal(safeLink('about.html'), 'about.html');
  assert.equal(safeLink('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(safeImageSrc('http://x.example/a.png'), '');
  assert.equal(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.equal(safeImageSrc(PNG), PNG);
  const spec = cleanSiteSpec({
    name: '<b>Shop</b>', lang: 'en', theme: { base: 'red' },
    logo: '<svg onload="alert(1)"><script>alert(1)</script><circle r="4"/></svg>',
    pages: [{ slug: 'Home Page', title: 'Home', sections: [
      { type: 'hero', title: 'Hi', link: 'javascript:alert(1)', image: { src: 'http://evil/x.png', prompt: 'a shop' } },
      { type: 'evil', title: 'dropped' },
      { type: 'contact', email: 'not-an-email', phone: '+20 100 000 0000' },
    ] }, { slug: 'index', title: 'Dup', sections: [{ type: 'text', text: 'x' }] }],
  })!;
  assert.equal(spec.pages[0]!.slug, 'index');
  assert.notEqual(spec.pages[1]!.slug, 'index');
  assert.equal(spec.theme.base, '#8a5a2b');
  assert.equal(spec.pages[0]!.sections.length, 2);
  assert.equal(spec.pages[0]!.sections[0]!.link, undefined);
  assert.equal(spec.pages[0]!.sections[0]!.image?.src, undefined);
  assert.equal(spec.pages[0]!.sections[1]!.email, undefined);
  assert.equal(spec.pages[0]!.sections[1]!.phone, '+20 100 000 0000');
  assert.doesNotMatch(spec.logo || '', /script|onload/i);
  assert.equal(cleanSiteSpec({ pages: [] }), undefined);
  assert.deepEqual(jsonFrom('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
});

test('studio pages: real, escaped, right-to-left HTML with working links', () => {
  const spec = briefToSpec('موقع لشركة برمجة اسمها «نور»');
  spec.pages[0]!.sections[0]!.title = '<script>alert(1)</script>';
  const home = renderPage(spec, 'index', 'export');
  assert.match(home, /<html lang="ar" dir="rtl">/);
  assert.doesNotMatch(home, /<script>alert/);
  assert.match(home, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(home, /href="about\.html"/);
  assert.match(home, /<link rel="stylesheet" href="styles\.css">/);
  assert.match(home, /fonts\.googleapis\.com/);
  const preview = renderPage(spec, 'about', 'preview');
  assert.match(preview, /data-page="index"/);
  assert.match(preview, /<style>:root\{--primary:/);
  assert.match(preview, /aria-current="page">من نحن/);
  const one = singleFile(spec);
  assert.equal((one.match(/<main data-page=/g) || []).length, 3);
  assert.match(one, /href="#\/contact"/);
  assert.equal(esc(`"'<>&`), '&quot;&#39;&lt;&gt;&amp;');
});

test('studio export: the ZIP has every page and picture, and opens again for editing', () => {
  const spec = briefToSpec('perfume shop named Musk', { language: 'en' });
  spec.pages[0]!.sections[0]!.image!.src = PNG;
  spec.logo = monogramSvg('Musk');
  const files = exportSite(spec);
  for (const f of ['index.html', 'about.html', 'contact.html', 'styles.css', 'site.json', 'README.txt', 'assets/image-1.png', 'assets/logo.svg']) assert.ok(files[f], f);
  assert.match(String(files['index.html']), /src="assets\/image-1\.png"/);
  assert.doesNotMatch(String(files['site.json']), /base64/);
  const back = openSite(zipSite(spec), 'en')!;
  assert.equal(back.name, 'Musk');
  assert.equal(back.pages.length, 3);
  assert.equal(back.pages[0]!.sections[0]!.image?.src, PNG);
  assert.match(back.logo || '', /^<svg/);
  assert.equal(openSite(JSON.stringify(spec))?.name, 'Musk');
  assert.equal(openSite(new Uint8Array([1, 2, 3])), undefined);
});

test('studio editing by words: the common changes happen on the device', () => {
  const spec = briefToSpec('متجر ملابس اسمه «لمسة»');
  const color = localEdit('خلي اللون أزرق', spec);
  assert.deepEqual(color.done, ['color']);
  assert.equal(color.spec.theme.base, '#1d4ed8');
  assert.equal(spec.theme.base, '#0e7490', 'the original is untouched (for undo)');
  assert.ok(localEdit('عايزه وضع ليلي', spec).spec.theme.dark);
  const faq = localEdit('ضيف قسم أسئلة', spec, 'index');
  assert.ok(faq.spec.pages[0]!.sections.some((s) => s.type === 'faq'));
  const noProducts = localEdit('احذف المنتجات', spec, 'index');
  assert.ok(!noProducts.spec.pages[0]!.sections.some((s) => s.type === 'products'));
  const renamed = localEdit('غير الاسم لـ نور', spec);
  assert.equal(renamed.spec.name, 'نور');
  assert.equal(renamed.spec.pages[0]!.sections[0]!.title, 'نور');
  const wa = localEdit('رقم الواتساب 01001234567', spec);
  assert.equal(wa.spec.pages[2]!.sections[0]!.whatsapp, '01001234567');
  const page = localEdit('ضيف صفحة الخدمات', spec);
  assert.equal(page.spec.pages.length, 4);
  assert.equal(page.spec.pages[3]!.title, 'الخدمات');
  const one = localEdit('خليه صفحة واحدة', spec);
  assert.equal(one.spec.pages.length, 1);
  assert.ok(!JSON.stringify(one.spec).includes('contact.html'));
  assert.ok(localEdit('make it dark mode', briefToSpec('a clinic', { language: 'en' })).spec.theme.dark);
  assert.deepEqual(localEdit('اكتب قصيدة عن البحر', spec).done, [], 'not a site change → goes to the AI');
});

test('studio AI edits: pictures travel as short markers and come back', () => {
  const spec = briefToSpec('a bakery named Crumb', { language: 'en' });
  const big = `data:image/png;base64,${'A'.repeat(2000)}`;
  spec.pages[0]!.sections[0]!.image!.src = big;
  spec.logo = monogramSvg('Crumb');
  const { json, restore } = forAi(spec);
  assert.ok(json.length < 8000);
  assert.match(json, /"src":"img:0"/);
  assert.doesNotMatch(json, /<svg/);
  const reply = `Here you go:\n\`\`\`json\n${json.replace('Crumb', 'Crumb & Co')}\n\`\`\``;
  const back = siteFromReply(reply, 'en', restore)!;
  assert.equal(back.name, 'Crumb & Co');
  assert.equal(back.pages[0]!.sections[0]!.image?.src, big);
  assert.match(back.logo || '', /<svg/);
  assert.equal(siteFromReply('no json here', 'en'), undefined);
});

test('studio logos: monograms in every shape, and outside SVG made safe', () => {
  assert.equal(initials('دار العطر'), 'دع');
  assert.equal(initials('Maison Scent'), 'MS');
  assert.equal(initials('الريف'), 'الريف');
  assert.equal(initials('The Oud House'), 'OH');
  const all = logoChoices('Sham', '#8a5a2b');
  assert.equal(all.length, 7 * 4 + 2);
  for (const c of all) { assert.match(c.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.equal(sanitizeSvg(c.svg).length > 0, true); }
  assert.match(monogramSvg('<x>'), /&lt;X&gt;|&lt;x&gt;/);
  const dirty = '<svg viewBox="0 0 10 10"><script>alert(1)</script><foreignObject><div/></foreignObject><a href="https://evil"><circle onclick="x()" r="1"/></a><use href="#g"/><rect style="fill:url(https://evil/x)" fill="url(#g)"/><image href="javascript:alert(1)"/></svg>';
  const clean = sanitizeSvg(dirty);
  assert.doesNotMatch(clean, /script|foreignObject|onclick|evil|javascript|<image|<a\b/i);
  assert.match(clean, /fill="url\(#g\)"/);
  assert.equal(sanitizeSvg('<div>no</div>'), '');
});

test('studio video: storyboards, timing, camera and music line up', () => {
  const short = localStoryboard('صقر ذهبي فوق الأهرامات', { seconds: 20 });
  assert.equal(short.scenes.length, 4);
  assert.equal(short.dir, 'rtl');
  assert.equal(totalSeconds(short.scenes), 20);
  assert.match(short.scenes[0]!.prompt, /falcon/);
  assert.match(short.scenes[0]!.prompt, /golden/);
  assert.match(short.scenes[0]!.prompt, /pyramids/);
  const story = localStoryboard('A boy finds a key. He opens a door in the forest. A dragon wakes up. They fly to the moon.', { seconds: 30, aspect: '9:16' });
  assert.equal(story.scenes.length, 4);
  assert.equal(story.aspect, '9:16');
  assert.equal(visualPrompt('قطة في الفضاء'), 'cat, outer space');
  const ai = cleanStoryboard({ title: 'Trip', scenes: [{ caption: 'one', prompt: 'p', seconds: 99, motion: 'spin' }, { text: 'two', seconds: 0.2 }, 'bad', {}] })!;
  assert.equal(ai.scenes.length, 2);
  assert.equal(ai.scenes[0]!.seconds, 12);
  assert.equal(ai.scenes[1]!.seconds, 2);
  assert.notEqual(ai.scenes[0]!.motion, 'spin');
  assert.equal(cleanStoryboard({ scenes: [] }), undefined);
  const scenes = [{ seconds: 4 }, { seconds: 4 }].map((s, i) => ({ ...s, id: String(i), caption: '', prompt: '', motion: 'zoom-in' as const }));
  assert.deepEqual(frameAt(0, scenes), { index: 0, p: 0, next: 1, mix: 0 });
  assert.equal(frameAt(3.6, scenes).mix.toFixed(2), '0.50');
  assert.equal(frameAt(5, scenes).index, 1);
  assert.equal(frameAt(99, scenes).p, 1);
  for (const m of ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'still'] as const) for (const p of [0, 0.5, 1]) {
    const [sx, sy, sw, sh] = coverRect(1024, 1024, 1280, 720, cameraAt(m, p));
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= 1024.001 && sy + sh <= 1024.001, `${m} ${p}`);
    assert.ok(Math.abs(sw / sh - 1280 / 720) < 0.01);
  }
  const plan = musicPlan('epic', 20);
  assert.equal(plan[0]!.at, 0);
  assert.ok(plan.at(-1)!.at + plan.at(-1)!.length >= 19.99);
  assert.ok(plan.every((c) => c.freqs.every((f) => f > 50 && f < 1000)));
  assert.deepEqual(wrapLines('one two three four five', 9), ['one two', 'three', 'four five']);
});

test('studio words: all ten main languages, no vendor names; the server knows the two new tasks', () => {
  for (const [key, text] of Object.entries(STUDIO_STRINGS)) {
    for (const l of TEN) assert.ok((text as Record<string, string>)[l]?.trim(), `${key}.${l}`);
    assert.doesNotMatch(Object.values(text).join(' '), /gemini|openai|chatgpt|claude|deepseek|pollinations|veo|sora/i, key);
  }
  for (const l of TEN) {
    assert.match(STUDIO_STRINGS.drawing_n[l], /\{n\}.*\{total\}/, l);
    assert.match(STUDIO_STRINGS.recording[l], /\{p\}/, l);
  }
  assert.equal(stText('en', 'drawing_n', { n: 2, total: 5 }), 'Drawing pictures… 2 of 5');
  for (const task of ['site', 'storyboard'] as const) {
    const text = workspaceInstruction('ar', task);
    assert.match(text, /JSON/);
    assert.doesNotMatch(text, /gemini|openai|chatgpt|gpt-|claude|anthropic|deepseek|google|llama/i);
  }
  assert.match(workspaceInstruction('ar', 'site'), /"pages"/);
  assert.match(workspaceInstruction('ar', 'storyboard'), /"scenes"/);
});

test('studio: the AI site reply survives the cleaner (a realistic answer)', () => {
  const reply = JSON.stringify({ name: 'Bloom', tagline: 'Flowers', lang: 'en', theme: { base: '#be185d', harmony: 'analogous', dark: false, font: 'playfair', radius: 'round' },
    pages: [{ slug: 'index', title: 'Home', sections: [{ type: 'hero', title: 'Bloom', text: 'Fresh flowers', button: 'Shop', link: '#offers', image: { prompt: 'flowers', alt: 'flowers' } }, { type: 'products', id: 'offers', title: 'Bouquets', items: [{ title: 'Rose', text: 'Red roses', image: { prompt: 'roses' } }] }] },
      { slug: 'about', title: 'About', sections: [{ type: 'about', title: 'Us', text: 'We love flowers' }] }] });
  const spec = siteFromReply(reply, 'en') as SiteSpec;
  assert.equal(spec.theme.font, 'playfair');
  assert.equal(spec.theme.radius, 'round');
  assert.equal(spec.pages[0]!.sections[1]!.id, 'offers');
  const html = renderPage(spec, 'index');
  assert.match(html, /id="offers"/);
  assert.match(html, /Playfair\+Display/);
});
