/**
 * «خيال شاهين» — the art director between an idea and the image engine (src/utils/imageCraft.ts), the
 * way the server uses it (server/workspace.ts → makeImage) and the lessons that teach it in the school.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IMAGE_ASPECTS, IMAGE_CRAFT_INSTRUCTION, IMAGE_STYLES, craftEditPrompt, craftImagePrompt, detectAspect, detectLettering, detectStyle,
  detectSubject, isImageAspect, isImageStyle, parseImageRequest,
} from '../src/utils/imageCraft';
import { IMAGE_FAILURE_RESPONSE, drawImage, makeImage, workspaceInstruction } from '../server/workspace';
import { publicChatResult, systemInstruction } from '../server/shaheen';
import { IMAGE_HONESTY_INSTRUCTION } from '../src/utils/imageCraft';
import { drawReply, drawingOf, forgetDrawings, freshReplies, previousDrawing } from '../src/utils/shaheenDrawings';
import { imageErrorKey } from '../src/workspace/workspaceApi';
import { imageRequest } from '../src/workspace/codeBlocks';
import { stripFormulaBlock } from '../src/components/ShaheenMarkdown';
import { ApiError, ApiUnavailableError } from '../src/utils/api';
import { IMAGE_SIZES } from '../src/workspace/ImagesPanel';
import { WS_STRINGS } from '../src/workspace/strings';
import { IMAGINATION_LESSONS } from '../scripts/shaheen-school/curriculumImagination';
import { academyLessons } from '../scripts/shaheen-school/curriculum';
import { lessonFor } from '../scripts/shaheen-school/school';

const VENDORS = /gemini|openai|chatgpt|dall|midjourney|claude|imagen|stable diffusion/i;

test('a short idea is kept word for word and gets the direction it left open', () => {
  const brief = craftImagePrompt('قطة في الفضاء');
  assert.ok(brief.prompt.includes('«قطة في الفضاء»'), 'the idea is passed in the person\'s own words');
  for (const part of ['Imagination:', 'Style:', 'Composition:', 'Lighting:', 'Colour:', 'Fidelity:', 'No text:']) assert.ok(brief.prompt.includes(part), part);
  assert.equal(brief.subject, 'animal');
  assert.equal(brief.enriched, true);
  assert.ok(brief.prompt.length < 3600, 'the brief fits the engine request');
  assert.doesNotMatch(brief.prompt, VENDORS);
});

test('style, mood, frame and lettering are read from Arabic and English words', () => {
  assert.equal(detectStyle('ارسم لي مدينة بألوان مائية'), 'watercolor');
  assert.equal(detectStyle('صورة أنمي لبنت بتقرا'), 'anime');
  assert.equal(detectStyle('a cinematic film still of a train'), 'cinematic');
  assert.equal(detectStyle('شعار لمحل عطور'), 'flat');
  assert.equal(detectStyle('كوباية شاي'), undefined);
  assert.equal(detectSubject('زجاجة عطر على رخام'), 'product');
  assert.equal(detectSubject('جبال وقت الغروب'), 'landscape');
  assert.equal(detectAspect('خلفية موبايل لغابة'), '9:16');
  assert.equal(detectAspect('بانر للموقع'), '16:9');
  assert.equal(detectAspect('a poster, 3:4'), '3:4');
  assert.equal(detectAspect('صورة ٩:١٦ لشارع'), '9:16');
  assert.equal(detectAspect('at 12:30 in the city'), undefined);
  assert.equal(detectAspect('كوباية شاي'), undefined);
  assert.deepEqual(detectLettering('زجاجة عطر مكتوب عليها «شام»'), { wanted: true, words: 'شام' });
  assert.deepEqual(detectLettering('قطة نايمة'), { wanted: false });

  const night = craftImagePrompt('بوستر خيالي لمدينة عربية طايرة فوق السحاب بالليل');
  assert.equal(night.style, 'fantasy');
  assert.equal(night.aspect, '3:4');
  assert.match(night.prompt, /Lighting: night/);
  assert.match(night.prompt, /fantasy concept art/);

  const bottle = craftImagePrompt('زجاجة عطر فخمة مكتوب عليها «شام»');
  assert.equal(bottle.lettering, 'شام');
  assert.match(bottle.prompt, /write exactly «شام» once.*right-to-left/);
  assert.doesNotMatch(bottle.prompt, /No text:/);
  assert.match(bottle.prompt, /hero product shot/);
});

test('the visitor\'s chips win over the guess; a logo is not turned into a scene', () => {
  const chosen = craftImagePrompt('قطة واقعية', { style: 'anime', aspect: '9:16' });
  assert.equal(chosen.style, 'anime');
  assert.equal(chosen.aspect, '9:16');
  assert.match(chosen.prompt, /anime illustration/);
  assert.match(chosen.prompt, /aspect ratio 9:16/);
  const auto = craftImagePrompt('قطة واقعية', { style: 'auto' });
  assert.equal(auto.style, 'photo');
  const logo = craftImagePrompt('شعار لمحل عطور');
  assert.equal(logo.aspect, '1:1');
  assert.doesNotMatch(logo.prompt, /Imagination:/);
  assert.match(logo.prompt, /flat vector/);
  const plain = craftImagePrompt('كوباية شاي');
  assert.equal(plain.aspect, undefined, 'nothing in the idea decides the frame');
  assert.doesNotMatch(plain.prompt, /Frame:/);
});

test('a full art-directed description is left whole; crafting twice changes nothing', () => {
  const directed = 'A cinematic wide shot of a lone falcon gliding over golden desert dunes at sunset, warm rim lighting, soft haze, shallow depth of field, rich amber and teal palette, photorealistic, 16:9';
  const brief = craftImagePrompt(directed);
  assert.equal(brief.enriched, false);
  assert.equal(brief.aspect, '16:9');
  assert.ok(brief.prompt.includes(directed));
  for (const part of ['Imagination:', 'Style:', 'Composition:', 'Lighting:', 'Colour:']) assert.ok(!brief.prompt.includes(part), part);
  assert.equal(craftImagePrompt(brief.prompt).prompt, brief.prompt);
  const once = craftImagePrompt('قطة في الفضاء').prompt;
  assert.equal(craftImagePrompt(once).prompt, once);
});

test('an edit changes one thing and keeps the picture; the chat marks it with EDIT:', () => {
  assert.deepEqual(parseImageRequest('EDIT: make it night'), { mode: 'edit', prompt: 'make it night' });
  assert.deepEqual(parseImageRequest('edit - remove the cup'), { mode: 'edit', prompt: 'remove the cup' });
  assert.deepEqual(parseImageRequest(' a red fox, editorial light '), { mode: 'new', prompt: 'a red fox, editorial light' });
  const edit = craftEditPrompt('EDIT: make it night');
  assert.match(edit, /^Edit the attached image/);
  assert.ok(edit.includes('«make it night»'));
  assert.match(edit, /Change only what is asked/);
  assert.match(craftEditPrompt('اكتب عليها "خصم"'), /write exactly «خصم»/);
});

test('the chat is taught the same craft, without naming a vendor', () => {
  const instruction = workspaceInstruction('ar');
  assert.ok(instruction.includes(IMAGE_CRAFT_INSTRUCTION));
  for (const word of ['sham-image', 'EDIT:', 'الإضاءة', 'التكوين', '9:16', 'علامتي تنصيص']) assert.ok(IMAGE_CRAFT_INSTRUCTION.includes(word), word);
  assert.doesNotMatch(IMAGE_CRAFT_INSTRUCTION, VENDORS);
});

const PNG = 'data:image/png;base64,aGVsbG8=';
const drawn = () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] } }] });
type Sent = { contents: [{ parts: Array<{ text?: string; inlineData?: unknown }> }]; generationConfig: { imageConfig?: { aspectRatio?: string } } };

test('the server draws the crafted brief with its frame, and edits keep the picture they were given', async () => {
  const sent: Sent[] = [];
  const request = (async (_url: unknown, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body)) as Sent); return drawn(); }) as typeof fetch;
  const env = { GEMINI_API_KEY: 'k' };

  assert.equal(await makeImage('جبال وقت الغروب', undefined, { env, fetch: request, style: 'watercolor' }), PNG);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].contents[0].parts[0].text?.includes('«جبال وقت الغروب»'));
  assert.match(sent[0].contents[0].parts[0].text || '', /watercolour painting/);
  assert.match(sent[0].contents[0].parts[0].text || '', /sharing ai signature/);
  assert.equal(sent[0].generationConfig.imageConfig?.aspectRatio, '16:9');

  assert.equal(await makeImage('كوباية شاي', undefined, { env, fetch: request }), PNG);
  assert.equal(sent[1].generationConfig.imageConfig, undefined, 'no frame is forced when nothing asks for one');

  assert.equal(await makeImage('خلّيها ليل', PNG, { env, fetch: request, aspect: '9:16' }), PNG);
  assert.match(sent[2].contents[0].parts[0].text || '', /^Edit the attached image/);
  assert.ok(sent[2].contents[0].parts[1].inlineData, 'the picture travels with the edit');
  assert.equal(sent[2].generationConfig.imageConfig, undefined, 'an edit keeps the shape of its picture');
});

test('an engine that refuses the frame field is asked once more without it; failures stay honest', async () => {
  const shapes: Array<string | undefined> = [];
  const picky = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Sent;
    shapes.push(body.generationConfig.imageConfig?.aspectRatio);
    return body.generationConfig.imageConfig ? Response.json({ error: 'unknown field' }, { status: 400 }) : drawn();
  }) as typeof fetch;
  assert.equal(await makeImage('بانر لمحل عطور', undefined, { env: { GEMINI_API_KEY: 'k' }, fetch: picky }), PNG);
  assert.deepEqual(shapes, ['16:9', undefined]);

  let calls = 0;
  const down = (async () => { calls += 1; return Response.json({}, { status: 429 }); }) as typeof fetch;
  assert.equal(await makeImage('قطة', undefined, { env: { GEMINI_API_KEY: 'k' }, fetch: down, aspect: '1:1' }), undefined);
  assert.equal(calls, 1, 'a spent quota is not retried');
  assert.equal(await makeImage('قطة', undefined, { env: {}, fetch: down }), undefined, 'no key, no image and no call');
  assert.equal(calls, 1);
});

test('every chip has its words and only real styles and shapes pass the route', () => {
  for (const id of IMAGE_STYLES) assert.ok(WS_STRINGS[`style_${id}`], id);
  assert.deepEqual(IMAGE_SIZES.map((s) => s.aspect).filter(Boolean), [...IMAGE_ASPECTS]);
  assert.equal(isImageStyle('anime'), true);
  assert.equal(isImageStyle('pixel'), false, 'recognised in words, but not a chip');
  assert.equal(isImageStyle({}), false);
  assert.equal(isImageAspect('16:9'), true);
  assert.equal(isImageAspect('21:9'), false);
});

test('the school teaches the imagination craft: each question finds exactly its lesson', () => {
  assert.ok(IMAGINATION_LESSONS.length >= 24, `only ${IMAGINATION_LESSONS.length} lessons`);
  const library = academyLessons();
  for (const { lesson, question } of IMAGINATION_LESSONS) {
    assert.equal(lessonFor(question, library), lesson, question.q);
    assert.ok(lesson.content.length >= 150, `${lesson.id} says too little`);
    assert.doesNotMatch(lesson.content, VENDORS, lesson.id);
    assert.equal(lesson.track, 'graphics');
  }
});

test('every reason an image did not come has its own code and its own sentence', async () => {
  const env = { GEMINI_API_KEY: 'reasons' };
  const answer = (response: () => Response) => (async () => response()) as typeof fetch;
  assert.deepEqual(await drawImage('قطة', undefined, { env: {}, fetch: answer(drawn) }), { failure: 'no_engine' });
  const quota = await drawImage('قطة', undefined, { env, fetch: answer(() => Response.json({ error: { message: 'Quota exceeded, limit: 0' } }, { status: 429 })) });
  assert.equal('failure' in quota && quota.failure, 'quota');
  assert.match('failure' in quota ? quota.detail || '' : '', /limit: 0/);
  const refused = await drawImage('قطة', undefined, { env, fetch: answer(() => Response.json({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [{ text: 'I cannot draw that' }] } }] })) });
  assert.deepEqual(refused, { failure: 'refused', status: 200, detail: 'IMAGE_SAFETY' });
  const rejected = await drawImage('قطة', undefined, { env, fetch: answer(() => Response.json({ error: 'API key not valid' }, { status: 403 })) });
  assert.equal('failure' in rejected && rejected.failure, 'rejected');
  const down = await drawImage('قطة', undefined, { env, fetch: (async () => { throw new TypeError('network'); }) as typeof fetch });
  assert.equal('failure' in down && down.failure, 'unreachable');

  assert.deepEqual(Object.values(IMAGE_FAILURE_RESPONSE).map((r) => r.code), ['NO_IMAGE_ENGINE', 'IMAGE_QUOTA', 'IMAGE_REFUSED', 'IMAGE_ENGINE_REJECTED', 'IMAGE_ENGINE_UNREACHABLE']);
  assert.equal(imageErrorKey(new ApiError(503, 'NO_IMAGE_ENGINE')), 'image_unavailable');
  assert.equal(imageErrorKey(new ApiUnavailableError()), 'image_unavailable');
  assert.equal(imageErrorKey(new ApiError(503, 'IMAGE_QUOTA')), 'image_quota');
  assert.equal(imageErrorKey(new ApiError(422, 'IMAGE_REFUSED')), 'image_refused');
  assert.equal(imageErrorKey(new ApiError(429, 'RATE_LIMITED')), 'rate_limited');
  assert.equal(imageErrorKey(new ApiError(502, 'IMAGE_ENGINE_REJECTED')), 'image_failed');
  for (const key of ['image_unavailable', 'image_quota', 'image_refused', 'rate_limited', 'image_failed', 'image_draw', 'image_retry'] as const) assert.ok(WS_STRINGS[key].ar, key);
});

test('a retired image model is replaced from the account\'s own list, once', async () => {
  const asked: string[] = [];
  const request = (async (url: unknown) => {
    const path = String(url);
    asked.push(path.replace(/^.*\/v1beta\//, ''));
    if (path.includes('models?')) return Response.json({ models: [
      { name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/imagen-5', supportedGenerationMethods: ['predict'] },
      { name: 'models/gemini-3-pro-image-preview', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3-flash-image', supportedGenerationMethods: ['generateContent'] },
    ] });
    return path.includes('gemini-3-flash-image') ? drawn() : Response.json({ error: 'model not found' }, { status: 404 });
  }) as typeof fetch;
  const result = await drawImage('كوباية شاي', undefined, { env: { GEMINI_API_KEY: 'retired' }, fetch: request });
  assert.deepEqual(result, { image: PNG, model: 'gemini-3-flash-image' });
  assert.deepEqual(asked, ['models/gemini-2.5-flash-image:generateContent', 'models?pageSize=200', 'models/gemini-3-flash-image:generateContent']);
});

test('«اسأل شاهين» is taught to draw, and never to send the visitor elsewhere', () => {
  const written = systemInstruction('ar');
  assert.ok(written.includes(IMAGE_CRAFT_INSTRUCTION) && written.includes(IMAGE_HONESTY_INSTRUCTION));
  assert.ok(!systemInstruction('ar', '', undefined, { voice: {} }).includes(IMAGE_CRAFT_INSTRUCTION), 'a spoken turn has no picture to show');
  for (const word of ['مشكلة تقنية', 'خارجي', 'من جديد']) assert.ok(IMAGE_HONESTY_INSTRUCTION.includes(word), word);
  assert.doesNotMatch(IMAGE_HONESTY_INSTRUCTION, VENDORS);
  assert.ok(workspaceInstruction('ar').includes(IMAGE_HONESTY_INSTRUCTION));

  const reply = 'تخيلت زجاجة كريستال بتطفو في الفضاء.\n\n```sham-image\nA crystal perfume bottle floating in space, glowing nebula, cinematic lighting, 3:4\n```';
  const sent = publicChatResult({ reply }, 'ارسم زجاجة عطر في الفضاء').reply;
  assert.equal(imageRequest(sent), 'A crystal perfume bottle floating in space, glowing nebula, cinematic lighting, 3:4', 'the order reaches the browser whole');
  assert.equal(stripFormulaBlock(sent), 'تخيلت زجاجة كريستال بتطفو في الفضاء.', 'the visitor reads the words, not the order');
});

test('a reply\'s picture is drawn once, a failure says why and can be retried, an edit carries the last picture', async () => {
  forgetDrawings();
  let calls = 0;
  const seen: Array<[string, string | undefined]> = [];
  const draw = async (prompt: string, previous?: string) => { calls += 1; seen.push([prompt, previous]); return PNG; };
  const note = imageErrorKey;
  const both = await Promise.all([drawReply('bot-1', 'a red fox', draw, note), drawReply('bot-1', 'a red fox', draw, note)]);
  assert.equal(calls, 1, 'the page and the floating window share one drawing');
  assert.deepEqual(both[0], { status: 'done', src: PNG });
  await drawReply('bot-1', 'a red fox', draw, note);
  assert.equal(calls, 1);

  let fail = true;
  const flaky = async () => { if (fail) throw new ApiError(503, 'IMAGE_QUOTA'); return PNG; };
  assert.deepEqual(await drawReply('bot-2', 'a blue bird', flaky, note), { status: 'error', note: 'image_quota' });
  fail = false;
  assert.deepEqual(await drawReply('bot-2', 'a blue bird', flaky, note), { status: 'done', src: PNG });

  forgetDrawings();
  await drawReply('bot-1', 'a red fox', draw, note);
  const ids = ['user-1', 'bot-1', 'user-2', 'bot-3'];
  assert.equal(previousDrawing(ids, 'bot-3'), PNG);
  assert.equal(previousDrawing(ids, 'bot-1'), undefined);
  await drawReply('bot-3', 'EDIT: make it night', draw, note, previousDrawing(ids, 'bot-3'));
  assert.deepEqual(seen.at(-1), ['make it night', PNG]);
  await drawReply('bot-4', 'a new castle', draw, note, PNG);
  assert.deepEqual(seen.at(-1), ['a new castle', undefined], 'a new picture is not an edit');
  freshReplies.add('bot-9'); forgetDrawings();
  assert.equal(freshReplies.size, 0);
  assert.equal(drawingOf('bot-1'), undefined);
});
