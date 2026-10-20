import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { cleanDesignCreative, createDesignBrief, designPrompt, parseDesignCreative, validateDesignRequest } from '../server/design/assistant';
import { buildDesignCollaborationContext } from '../server/design/collaboration';
import type { Product } from '../server/core/types';
import type { DesignBriefRequest, DesignCreativeBrief } from '../src/types/design';
import { DESIGN_OBJECTIVES, DESIGN_PLATFORMS, DESIGN_SPECIALTIES } from '../src/types/design';
import { ADMIN_STRINGS } from '../src/admin/adminL10n';
import { designLessonFor, DESIGN_CURRICULUM } from '../src/design/curriculum';
import { AI_TOOLS } from '../src/utils/aiTools';
import { BOTS } from '../src/utils/shaheenOrg';

const product: Product = {
  id: 'perfume-1', sku: 'SHM-001', nameAr: 'عطر ورد وعنبر', nameEn: 'Rose & Amber', category: 'perfume',
  price: 525, currency: 'EGP', stock: 5, unit: 'bottle', descriptionAr: 'عطر ورد وعنبر دافئ.', descriptionEn: 'A warm rose and amber perfume.',
  tags: ['rose', 'amber'], active: true, updatedAt: '2026-10-19T00:00:00.000Z',
};

const creative: DesignCreativeBrief = {
  specialty: 'advertising_creative',
  title: 'دفء الورد',
  concept: 'تصور هادئ يمزج دفء العنبر بلمسة الورد.',
  format: 'ستوري عمودي 9:16',
  strategy: 'إبراز الإحساس الدافئ دون ادعاءات عن الثبات أو الخصومات.',
  audience: 'محبو الروائح الشرقية',
  visualDirection: 'زجاجة العطر في ضوء ذهبي ناعم وخلفية داكنة.',
  informationArchitecture: 'العلامة أولاً، ثم وصف مختصر، ثم الإجراء.',
  layout: 'الزجاجة في الثلث السفلي مع فراغ علوي للعنوان.',
  palette: [
    { name: 'أسود ليلي', hex: '#17130F', use: 'الخلفية' },
    { name: 'ذهبي دافئ', hex: '#C9A35B', use: 'العنوان والإطار' },
    { name: 'وردي هادئ', hex: '#C98488', use: 'لمسات الورد' },
  ],
  typography: 'عنوان عربي واضح بخط أنيق ووزن متوسط.',
  experienceFlow: '',
  interactionNotes: '',
  headline: 'دفء يليق بمساءك',
  caption: 'ورد ناعم ولمسة عنبر دافئة في كل رشة.',
  cta: 'اكتشف العطر',
  assetDirection: 'استخدم صورة العبوة الأصلية المعتمدة فقط، مع بتلات ورد طبيعية.',
  assetSearchTerms: ['soft amber perfume photography', 'natural rose petals'],
  imagePrompt: 'Premium perfume bottle on dark stone, warm amber light, soft rose petals, elegant negative space, no text.',
  altText: 'زجاجة عطر أنيقة بإضاءة ذهبية وبتلات ورد على خلفية داكنة.',
  responsiveNotes: 'حافظ على فراغ آمن أعلى وأسفل واجهة الستوري.',
  accessibilityNotes: 'تحقق من تباين النص مع الخلفية ولا تعتمد على اللون وحده.',
  productionNotes: 'استخدم صورة العبوة المصرح بها، وراجع أبعاد المنصة قبل التصدير.',
  successCriteria: 'وضوح الرسالة والمنتج في معاينة شاشة هاتف.',
  qualityChecklist: ['تأكيد صورة المنتج والحقوق.', 'اختبار القراءة والتباين على الهاتف.', 'مراجعة خلو النص من ادعاءات غير موثقة.'],
  siteImprovementIdeas: [],
};

const input: DesignBriefRequest = {
  brief: 'إعلان هادئ لعطر ورد وعنبر، يركز على الهدوء والدفء دون خصومات.',
  specialty: 'advertising_creative',
  platform: 'instagram_story',
  objective: 'awareness',
  audience: 'محبو العطور الشرقية',
  language: 'ar',
  productId: product.id,
  includeRetailPrice: true,
};

function fakeOpenAiFetch(reply: unknown, inspect?: (body: Record<string, unknown>) => void) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    inspect?.(body);
    return new Response(JSON.stringify({ choices: [{ message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) } }] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

test('the specialty, objective and deliverable taxonomy covers many design disciplines and leaves a custom path', () => {
  assert.ok(DESIGN_SPECIALTIES.length >= 40);
  assert.ok(DESIGN_PLATFORMS.length >= 38);
  assert.ok(DESIGN_OBJECTIVES.includes('accessibility'));
  assert.ok(DESIGN_SPECIALTIES.includes('industrial_product'));
  assert.ok(DESIGN_PLATFORMS.includes('custom_design'));
  const studioSource = readFileSync(new URL('../src/admin/DesignStudioPanel.tsx', import.meta.url), 'utf8');
  for (const specialty of DESIGN_SPECIALTIES) assert.ok(studioSource.includes(`id: '${specialty}'`), `studio has no option for ${specialty}`);
  for (const deliverable of DESIGN_PLATFORMS) assert.ok(studioSource.includes(`id: '${deliverable}'`), `studio has no option for ${deliverable}`);
  for (const [, key] of studioSource.matchAll(/T\('([^']*)'\)/g)) assert.ok(ADMIN_STRINGS[key]?.en, `studio string is not translated: ${key}`);
  assert.ok(DESIGN_CURRICULUM.length >= 28);
  for (const specialty of DESIGN_SPECIALTIES) assert.ok(DESIGN_CURRICULUM.some((lesson) => lesson.specialties.includes(specialty)), `${specialty} has no curriculum lesson`);
  const morningLesson = designLessonFor('industrial_product', new Date('2026-10-19T00:00:00Z'));
  const eveningLesson = designLessonFor('industrial_product', new Date('2026-10-19T12:00:00Z'));
  assert.ok(morningLesson.id.startsWith('design-'));
  assert.ok(eveningLesson.id.startsWith('design-'));
  assert.notEqual(morningLesson.id, eveningLesson.id, 'a specialty with multiple lessons rotates on the 12-hour cycle');
});

test('design request validation is strict, bounded and requires a product before adding its price', () => {
  assert.throws(() => validateDesignRequest(null), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateDesignRequest({ brief: 'short', platform: 'instagram_story', objective: 'awareness', language: 'ar' }), { code: 'INVALID_BRIEF' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid campaign request', platform: 'unknown', objective: 'awareness', language: 'ar' }), { code: 'INVALID_PLATFORM' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid campaign request', platform: 'instagram_story', objective: 'awareness', language: 'fr' }), { code: 'INVALID_LANGUAGE' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid campaign request', platform: 'instagram_story', objective: 'unknown', language: 'ar' }), { code: 'INVALID_OBJECTIVE' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid campaign request', specialty: 'unknown', platform: 'instagram_story', objective: 'awareness', language: 'ar' }), { code: 'INVALID_SPECIALTY' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid custom specialty request', specialty: 'custom', platform: 'instagram_story', objective: 'awareness', language: 'ar' }), { code: 'CUSTOM_SPECIALTY_REQUIRED' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid custom deliverable request', specialty: 'custom', customSpecialty: 'Museum journey', platform: 'custom_design', objective: 'awareness', language: 'ar' }), { code: 'CUSTOM_DELIVERABLE_REQUIRED' });
  assert.throws(() => validateDesignRequest({ brief: 'A valid campaign request', platform: 'instagram_story', objective: 'awareness', language: 'ar', includeRetailPrice: true }), { code: 'PRICE_NEEDS_PRODUCT' });
  const valid = validateDesignRequest({ ...input });
  assert.equal(valid.platform, 'instagram_story');
  assert.equal(valid.specialty, 'advertising_creative');
  assert.equal(valid.includeRetailPrice, true);
  const legacy = validateDesignRequest({ brief: 'A valid legacy campaign request', platform: 'instagram_story', objective: 'awareness', language: 'ar' });
  assert.equal(legacy.specialty, 'advertising_creative');
});

test('the design prompt uses only selected catalogue facts and never sends supplier cost or margin', () => {
  const withoutPrice = designPrompt({ ...input, includeRetailPrice: false }, product, 'audit facts');
  assert.match(withoutPrice, /Rose & Amber/);
  assert.match(withoutPrice, /audit facts/);
  assert.doesNotMatch(withoutPrice, /"retailPrice"|525|supplierEgp|margin/i);
  const withPrice = designPrompt(input, product);
  assert.match(withPrice, /amount is not included in this prompt/i);
  assert.doesNotMatch(withPrice, /525|"retailPrice"|supplierEgp|supplier cost|internal margin/i);
});

test('the collaboration prompt exposes registered roles separately from redacted relevant reports', async () => {
  const context = await buildDesignCollaborationContext({ env: { NODE_ENV: 'test' }, specialty: 'ui_ux' });
  assert.equal(context.team.length, AI_TOOLS.length + BOTS.filter((bot) => bot.id !== 'design_expert').length);
  assert.ok(context.team.some((member) => member.id === 'tool:design_agent'));
  assert.ok(context.team.some((member) => member.id === 'bot:languages'));
  assert.match(context.prompt, /أدوات الذكاء المسجلة/);
  assert.match(context.prompt, /التقارير المختصرة المتاحة/);
  assert.match(context.prompt, /وكيل اللغات/);
  assert.match(context.prompt, /تدقيق التصميم/);
  assert.doesNotMatch(context.prompt, /supplierEgp|supplier cost|internal margin|visitor-memory|conversation transcripts/i);
  assert.ok(context.sources.some((source) => source.id === 'design_audit'));
  assert.ok(context.sources.some((source) => source.id === 'languages'));
});

test('creative output is parsed defensively and untrusted links, invalid colours and model names are rejected', () => {
  assert.deepEqual(parseDesignCreative(`\`\`\`json\n${JSON.stringify(creative)}\n\`\`\``), creative);
  assert.equal(cleanDesignCreative({ ...creative, palette: [{ name: 'bad', hex: 'gold', use: 'x' }] }), undefined);
  assert.equal(cleanDesignCreative({ ...creative, headline: 'OpenAI approved' }), undefined);
  const cleaned = cleanDesignCreative({ ...creative, caption: 'Read more at https://example.test/ad' });
  assert.ok(cleaned);
  assert.doesNotMatch(cleaned!.caption || '', /https?:/);
  assert.equal(parseDesignCreative('not a JSON design'), undefined);
});

test('the design specialist uses Shaheen’s allowed engines, returns structured output and keeps the catalogue price separate', async () => {
  const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['openai'] as typeof SHAHEEN_SITE_SETTINGS.engines, models: { openai: 'gpt-4o-mini' } };
  let system = '';
  const fetch = fakeOpenAiFetch(creative, (body) => {
    const messages = body.messages as { role: string; content: string }[];
    system = messages.find((message) => message.role === 'system')?.content || '';
    assert.match(messages.at(-1)?.content || '', /merchantBrief/);
    assert.match(messages.at(-1)?.content || '', /amount is not included in this prompt/i);
    assert.doesNotMatch(messages.at(-1)?.content || '', /525/);
  });
  const result = await createDesignBrief(input, {
    settings,
    env: { NODE_ENV: 'test', OPENAI_API_KEY: 'test-key' },
    fetch,
    product,
  });
  assert.match(system, /تحت الإشراف المباشر للخبير شاهين/);
  assert.equal(result.creative.headline, creative.headline);
  assert.deepEqual(result.retailPrice, { amount: 525, currency: 'EGP' });
  assert.ok(result.collaboration.team.length > 0);
  assert.equal(result.collaboration.learning.id.startsWith('design-'), true);
  assert.equal(result.collaboration.privacyNoteAr.includes('لم تُستدعَ الأدوات ذات الأثر الجانبي'), true);
  assert.ok(Number.isFinite(Date.parse(result.createdAt)));
});

test('custom specialty and deliverable survive validation and are surfaced by the server, not invented by the model', async () => {
  const settings = { ...SHAHEEN_SITE_SETTINGS, engines: ['openai'] as typeof SHAHEEN_SITE_SETTINGS.engines, models: { openai: 'gpt-4o-mini' } };
  const request = validateDesignRequest({
    brief: 'Design an interactive scent exhibition journey for a small museum.',
    specialty: 'custom', customSpecialty: 'Interactive scent exhibition design',
    platform: 'custom_design', customDeliverable: 'A 5-step visitor-experience concept',
    objective: 'education', language: 'en',
  });
  const result = await createDesignBrief(request, {
    settings,
    env: { NODE_ENV: 'test', OPENAI_API_KEY: 'test-key' },
    fetch: fakeOpenAiFetch(creative),
  });
  assert.equal(result.creative.specialty, 'custom');
  assert.equal(result.creative.specialtyLabel, 'Interactive scent exhibition design');
  assert.equal(result.creative.format, 'A 5-step visitor-experience concept');
  assert.deepEqual(result.creative.siteImprovementIdeas, []);
});

test('no configured engine yields an honest error instead of a canned design', async () => {
  await assert.rejects(
    createDesignBrief(input, { settings: { ...SHAHEEN_SITE_SETTINGS, engines: ['openai'] }, env: { NODE_ENV: 'test', OPENAI_API_KEY: '' } }),
    { code: 'PROVIDER_NOT_CONFIGURED' },
  );
});
