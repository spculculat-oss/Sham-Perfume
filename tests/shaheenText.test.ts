import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShaheenMarkdown } from '../src/components/ShaheenMarkdown';
import { latexToText, plainMath, stripOpeningGreeting } from '../src/utils/shaheenText';
import { publicChatResult } from '../server/shaheen';

// Captured from the live «تحليل معمّق» answer (inspection run 38723830541).
const LIVE_DEEP = [
  'لتحضير لتر واحد (1000 مل) من الكحول بتركيز 70% باستخدام كحول تركيزه 96%، سنستخدم قانون تخفيف المحاليل ($C_1 \\times V_1 = C_2 \\times V_2$).',
  '',
  '### الحسابات خطوة بخطوة',
  '',
  '1. **المعطيات:**',
  '   * التركيز الابتدائي ($C_1$): 96%',
  '   * التركيز المطلوب ($C_2$): 70%',
  '',
  '2. **حساب حجم الكحول 96% المطلوب ($V_1$):**',
  '   $$V_1 = \\frac{C_2 \\times V_2}{C_1}$$',
  '   $$V_1 = \\frac{70 \\times 1000}{96} = \\frac{70000}{96} \\approx 729.17 \\text{ مل}$$',
  '',
  '3. **حساب حجم الماء المقطر المطلوب:**',
  '   $$V_{\\text{water}} = V_2 - V_1$$',
  '',
  '---',
  '',
  '| المكون | الكمية |',
  '| :--- | :--- |',
  '| **الكحول** | **729.2 مل** |',
].join('\n');

test('LaTeX becomes readable math', () => {
  assert.equal(latexToText('V_1 = \\frac{70 \\times 1000}{96} \\approx 729.17 \\text{ مل}'), 'V₁ = (70 × 1000) ÷ 96 ≈ 729.17 مل');
  assert.equal(latexToText('V_{\\text{water}} = V_2 - V_1'), 'V(water) = V₂ - V₁');
  assert.equal(latexToText('\\sqrt{x^2} \\leq 10\\%'), '√(x²) ≤ 10%');
  assert.equal(latexToText('\\frac{\\frac{a}{b}}{c}'), '(a ÷ b) ÷ c');
});

test('prices and plain dollar signs are left alone', () => {
  assert.equal(plainMath('السعر $5 أو $10 للزجاجة'), 'السعر $5 أو $10 للزجاجة');
  assert.equal(plainMath('بدون رياضيات'), 'بدون رياضيات');
});

test('the live deep answer renders without any LaTeX, with nested points and numbered steps', () => {
  const html = renderToStaticMarkup(createElement(ShaheenMarkdown, { text: LIVE_DEEP }));
  assert.doesNotMatch(html, /\$|\\frac|\\times|\\text|\\approx|\u2045|\u2046/);
  assert.match(html, /<span dir="ltr"[^>]*>V₁ = \(70 × 1000\) ÷ 96 = 70000 ÷ 96 ≈ 729.17 مل<\/span>/);
  assert.match(html, /<span dir="ltr"[^>]*>C₁ × V₁ = C₂ × V₂<\/span>/);
  // "المعطيات" keeps its two sub-points as a nested list instead of "* … * …" run-on text.
  assert.match(html, /<li><strong[^>]*>المعطيات:<\/strong><ul[^>]*><li>التركيز الابتدائي/);
  assert.doesNotMatch(html, /\* التركيز/);
  // The three steps stay ONE numbered list (1, 2, 3), math inside bold works.
  assert.equal((html.match(/<ol/g) || []).length, 1);
  assert.match(html, /<strong[^>]*>حساب حجم الكحول 96% المطلوب \(<span dir="ltr"[^>]*>V₁<\/span>\):<\/strong>/);
  assert.match(html, /<hr/);
  assert.match(html, /<table/);
});

test('a numbered list split by a paragraph keeps counting', () => {
  const html = renderToStaticMarkup(createElement(ShaheenMarkdown, { text: '1. أول\n\nفقرة\n\n2. ثاني' }));
  assert.match(html, /<ol start="2"/);
});

test('an opening «أهلاً بك.» is dropped for real questions, kept when the visitor greets', () => {
  const reply = 'أهلاً بك. لتصميم عطر شرقي متوازن بالعود والورد بحجم 50 مل نحتاج إلى ما يلي';
  assert.equal(stripOpeningGreeting(reply, 'صمم لي عطر شرقي بالعود والورد'), 'لتصميم عطر شرقي متوازن بالعود والورد بحجم 50 مل نحتاج إلى ما يلي');
  assert.equal(stripOpeningGreeting(reply, 'مرحبا يا شاهين'), reply);
  assert.equal(stripOpeningGreeting('مرحباً! كيف أساعدك؟', 'سؤال'), 'مرحباً! كيف أساعدك؟');
  assert.equal(stripOpeningGreeting('أهلاً وسهلاً، إليك الحسابات المطلوبة لتخفيف الكحول', 'خفف كحول'), 'إليك الحسابات المطلوبة لتخفيف الكحول');
  assert.equal(publicChatResult({ reply, mode: 'auto' }, 'صمم لي عطر').reply.startsWith('لتصميم'), true);
});

test('no empty or black code boxes: stray fences around a removed formula block disappear', () => {
  const f = '{"title":"x","concentrationPercent":20,"bottleVolumeMl":50,"pyramidNotes":[{"nameAr":"ورد","category":"heart","percentageOfOil":100}]}';
  const cases = [
    `نص\n\n\`\`\`sham-formula\n\`\`\`json\n${f}\n\`\`\`\n\`\`\``,
    `نص\n\n\`\`\`sham-formula\n${f}\n\`\`\`\n\`\`\``,
    'نص\n\n```json\n```',
    'نص\n```',
    'نص\n\n```\n{"unknown": true}\n```',
  ];
  for (const text of cases) {
    const html = renderToStaticMarkup(createElement(ShaheenMarkdown, { text }));
    assert.doesNotMatch(html, /<pre|```|\{"/, text);
    assert.match(html, /نص/);
  }
  // A calculation the model fenced reads as text in a soft box, not as a code panel.
  const calc = renderToStaticMarkup(createElement(ShaheenMarkdown, { text: '```\nالكحول = 70 × 1000 ÷ 96 ≈ 729 مل\n```' }));
  assert.doesNotMatch(calc, /<pre|<code/);
  assert.match(calc, /<div dir="auto"[^>]*>الكحول = 70 × 1000 ÷ 96 ≈ 729 مل<\/div>/);
});
