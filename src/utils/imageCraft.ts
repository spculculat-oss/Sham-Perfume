/**
 * «خيال شاهين» — the art director that stands between a short idea and the image engine.
 *
 * The big assistants do not hand "قطة في الفضاء" to their image model as it is: they first read what the
 * person meant, keep every detail he named, fill what he left out (setting, light, camera, colour, mood,
 * frame shape) and only then draw. This file is that step for Shaheen — pure rules, no AI call and no
 * quota, shared by the browser (the style/size chips) and the server (server/workspace.ts → makeImage).
 *
 * It never invents a result: it only writes the brief. When the engine is missing the route still answers
 * NO_IMAGE_ENGINE honestly.
 */

export const IMAGE_STYLES = ['auto', 'photo', 'cinematic', 'fantasy', 'anime', 'cartoon3d', 'watercolor', 'oil', 'sketch'] as const;
export type ImageStyleId = typeof IMAGE_STYLES[number];
/** Styles Shaheen recognises in the words but that have no chip of their own. */
type HiddenStyle = 'pixel' | 'flat' | 'ornament';
type AnyStyle = Exclude<ImageStyleId, 'auto'> | HiddenStyle;

export const IMAGE_ASPECTS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
export type ImageAspect = typeof IMAGE_ASPECTS[number];

export type SubjectKind = 'portrait' | 'product' | 'landscape' | 'architecture' | 'animal' | 'food' | 'emblem' | 'scene';

export interface ImageBrief {
  /** The engine prompt: the person's own words plus the art direction he did not write himself. */
  prompt: string;
  style: AnyStyle | 'free';
  subject: SubjectKind;
  /** Sent to the engine as the frame shape; undefined = nothing in the idea decides it. */
  aspect?: ImageAspect;
  /** The exact words to letter on the image, when the idea quoted them. */
  lettering?: string;
  /** False when the idea was already a full art-directed description and was only tidied. */
  enriched: boolean;
}

export const isImageStyle = (value: unknown): value is ImageStyleId => typeof value === 'string' && (IMAGE_STYLES as readonly string[]).includes(value);
export const isImageAspect = (value: unknown): value is ImageAspect => typeof value === 'string' && (IMAGE_ASPECTS as readonly string[]).includes(value);

/** One spelling for matching: no tashkeel, one alef, one ya/ta-marbuta, lower case. */
const fold = (value: string) => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

// ── What the words ask for ────────────────────────────────────────────────────────────────────────────────
const STYLE_WORDS: [AnyStyle, RegExp][] = [
  ['pixel', /بكسل|pixel[\s-]?art|8[\s-]?bit/],
  ['flat', /شعار|لوجو|لوغو|ايقون|فيكتور|مينيمال|\blogo\b|\bicon\b|\bvector\b|\bflat\b|\bminimal(?:ist)?\b|\bemblem\b/],
  ['ornament', /زخرف|ارابيسك|نقوش اسلاميه|mandala|arabesque|islamic (?:pattern|geometr)|ornament/],
  ['watercolor', /الوان مائيه|مائيه|اكواريل|water[\s-]?colou?r|aquarelle/],
  ['oil', /زيتيه|زيتي|لوحه كلاسيك|oil[\s-]?paint|impasto/],
  ['sketch', /رصاص|سكتش|اسكتش|فحم|تخطيط|حبر|\bpencil\b|\bsketch\b|\bcharcoal\b|line[\s-]?art|\bink\b/],
  ['anime', /انمي|انيمي|مانجا|\banime\b|\bmanga\b/],
  ['cartoon3d', /كرتون|كارتون|ثلاثي الابعاد|مجسم|\bcartoon\b|\b3d\b|\bclay\b|\bstylized render\b/],
  ['cinematic', /سينمائي|مشهد فيلم|لقطه فيلم|\bcinematic\b|film still|movie (?:still|scene)|\banamorphic\b/],
  ['fantasy', /خيالي|خيال|فانتازيا|اسطور|سحري|سحر|سريالي|حلم|احلام|تخيل|\bfantasy\b|\bmagical?\b|\bmyth(?:ical|ic)?\b|\bsurreal\b|\bdream(?:y|like)?\b|\bfairy[\s-]?tale\b|\bsci-?fi\b/],
  ['photo', /واقعي|فوتوغراف|تصوير احترافي|photo-?real|\brealistic\b|\bphotograph(?:y|ic)?\b|\bdslr\b|\bphoto\b/],
];

const SUBJECT_WORDS: [SubjectKind, RegExp][] = [
  ['emblem', /شعار|لوجو|لوغو|ايقون|\blogo\b|\bicon\b|\bemblem\b|\bbadge\b/],
  ['product', /عطر|عطور|زجاجه|قاروره|منتج|علبه|عبوه|ساعه يد|\bperfume\b|\bbottle\b|\bproduct\b|\bpackshot\b|\bpackaging\b|\bflacon\b|\bwatch\b/],
  ['food', /اكل|طبق|وجبه|حلوي|قهوه|كيك|\bfood\b|\bdish\b|\bmeal\b|\bcake\b|\bcoffee\b|\bdessert\b/],
  ['portrait', /بورتريه|وجه|رجل|راجل|امراه|ست |بنت|ولد|طفل|شاب|فتاه|شخص|فارس|ملك|اميره|عجوز|\bportrait\b|\bface\b|\bman\b|\bwoman\b|\bgirl\b|\bboy\b|\bchild\b|\bperson\b|\bknight\b|\bqueen\b|\bking\b|\bprincess\b/],
  ['animal', /قطه|قط |كلب|حصان|اسد|نمر|طائر|عصفور|صقر|شاهين|سمك|حوت|تنين|\bcat\b|\bdog\b|\bhorse\b|\blion\b|\btiger\b|\bbird\b|\bfalcon\b|\bfish\b|\bwhale\b|\bdragon\b|\bwolf\b|\bfox\b/],
  ['architecture', /مبني|قصر|مسجد|بيت|برج|قلعه|شارع|غرفه|\bbuilding\b|\bpalace\b|\bmosque\b|\bhouse\b|\btower\b|\bcastle\b|\bstreet\b|\binterior\b|\broom\b/],
  ['landscape', /منظر|طبيعه|جبل|جبال|بحر|شاطئ|صحرا|غابه|مدينه|سما|فضا|مجره|كوكب|نهر|حديقه|واحه|\blandscape\b|\bmountains?\b|\bsea\b|\bocean\b|\bbeach\b|\bdesert\b|\bforest\b|\bcity\b|\bskyline\b|\bspace\b|\bgalaxy\b|\bplanet\b|\briver\b|\bgarden\b|\bvalley\b/],
];

const MOODS: [RegExp, string][] = [
  [/ليل|بالليل|\bnight\b|\bmidnight\b|\bmoonlit\b/, 'night: deep blues and soft shadow, lit by the moon and warm practical lights'],
  [/غروب|ساعه ذهبيه|\bsunset\b|\bgolden hour\b|\bdusk\b/, 'golden hour: low warm sun, long soft shadows, glowing rim light'],
  [/شروق|فجر|\bsunrise\b|\bdawn\b/, 'dawn: cool pale light turning warm at the horizon, light morning haze'],
  [/مطر|ممطر|\brain(?:y|ing)?\b|\bstorm\b/, 'rain: wet reflective surfaces, soft diffused light, visible droplets'],
  [/ضباب|\bfog(?:gy)?\b|\bmist(?:y)?\b/, 'mist: layered depth fading into soft haze'],
  [/ثلج|شتا|\bsnow(?:y)?\b|\bwinter\b/, 'winter: cold clean light, muted palette, fine snow detail'],
  [/نيون|سايبربانك|\bneon\b|\bcyberpunk\b/, 'neon: saturated magenta and cyan signs reflected in dark surfaces'],
  [/مرعب|رعب|مظلم|\bhorror\b|\bdark\b|\beerie\b|\bgothic\b/, 'dark and tense: low-key lighting, heavy shadow, a single cold light source'],
  [/حزين|حزن|وحده|\bsad\b|\blonely\b|\bmelanchol/, 'melancholy: desaturated cool tones, quiet empty space around the subject'],
  [/سعيد|فرح|مبهج|بهجه|\bhappy\b|\bjoyful\b|\bcheerful\b|\bplayful\b/, 'joyful: bright open light, lively warm colours'],
  [/هادي|هدوء|سكينه|\bcalm\b|\bpeaceful\b|\bserene\b/, 'serene: soft even light, gentle pastel harmony, uncluttered frame'],
  [/ملحمي|مهيب|عظيم|\bepic\b|\bmajestic\b|\bgrand\b/, 'epic: vast scale against a small figure, dramatic sky, strong directional light'],
  [/فخم|فاخر|ملكي|\blux(?:ury|urious)\b|\bpremium\b|\broyal\b|\belegant\b/, 'luxurious: rich deep tones with gold accents, polished surfaces, restrained elegance'],
];

// ── What each style and subject bring when the idea is silent ─────────────────────────────────────────────
const STYLE_DIRECTION: Record<AnyStyle, { look: string; light: string; finish: string }> = {
  photo: { look: 'photorealistic photograph, true-to-life materials and skin texture', light: 'natural motivated light with soft shadow falloff', finish: 'sharp focus on the subject, shallow depth of field, fine realistic detail' },
  cinematic: { look: 'cinematic film still, widescreen feeling, considered colour grade', light: 'dramatic directional light with atmospheric haze and a clear key/fill contrast', finish: 'filmic depth, gentle grain, subject separated from the background' },
  fantasy: { look: 'imaginative fantasy concept art, painterly and richly detailed, a world that could not be photographed', light: 'luminous magical light, glowing accents and volumetric rays', finish: 'layered depth from foreground to far background, intricate but readable detail' },
  anime: { look: 'anime illustration, clean confident line work, cel shading, expressive faces', light: 'bright graphic lighting with soft gradient skies', finish: 'crisp shapes, detailed painted background' },
  cartoon3d: { look: 'stylized 3D animated-film render, rounded appealing shapes, soft materials', light: 'soft global illumination with a warm key light and gentle rim', finish: 'smooth clean surfaces, friendly proportions' },
  watercolor: { look: 'watercolour painting on textured paper, transparent washes, soft bleeding edges', light: 'airy light with the white of the paper showing through', finish: 'loose brushwork, a few precise details on the subject only' },
  oil: { look: 'classical oil painting, visible brush strokes, rich layered pigment', light: 'chiaroscuro: one warm light source and deep transparent shadows', finish: 'canvas texture, painterly edges, museum-quality composition' },
  sketch: { look: 'hand-drawn pencil and ink sketch, confident line work, cross-hatching for tone', light: 'tone built from hatching rather than colour', finish: 'paper texture, mostly monochrome, unfinished edges left on purpose' },
  pixel: { look: 'pixel art, limited palette, crisp square pixels, no anti-aliasing', light: 'flat graphic shading in two or three steps', finish: 'readable silhouette at small size' },
  flat: { look: 'flat vector design, simple geometric shapes, bold clean silhouette', light: 'no realistic lighting — flat colour with at most one subtle gradient', finish: 'centred on a plain background, generous margins, scalable and uncluttered' },
  ornament: { look: 'intricate ornamental design with geometric and arabesque motifs, precise symmetry', light: 'even light that shows the pattern, soft metallic sheen on gold lines', finish: 'fine repeating detail, balanced and symmetrical' },
};

const SUBJECT_DIRECTION: Record<SubjectKind, { compose: string; aspect: ImageAspect }> = {
  portrait: { compose: 'the figure is the clear focus, framed from the chest or waist up at eye level, background softly out of focus', aspect: '3:4' },
  product: { compose: 'hero product shot: the object stands slightly off-centre on a surface that suits it, three-quarter angle, clean supporting props, uncluttered background', aspect: '3:4' },
  landscape: { compose: 'wide establishing view with a foreground element, a middle ground and a far horizon; a leading line guides the eye', aspect: '16:9' },
  architecture: { compose: 'straight verticals, a clear vanishing point, a human-scale detail that shows the size of the place', aspect: '4:3' },
  animal: { compose: 'the animal fills about half the frame, eyes in sharp focus, shown at its own eye level', aspect: '4:3' },
  food: { compose: 'appetising close view at a 45-degree angle, shallow depth of field, a simple styled surface', aspect: '1:1' },
  emblem: { compose: 'one centred mark on a plain background with generous empty space around it', aspect: '1:1' },
  scene: { compose: 'one clear focal point placed on a third, supporting elements arranged around it, real depth between foreground and background', aspect: '4:3' },
};

const HAS_LIGHT = /\blight(?:ing|s)?\b|\blit\b|\bglow(?:ing)?\b|\bbacklit\b|\bgolden hour\b|\bshadows?\b|\bsunlight\b|اضاءه|ضوء|نور /;
const HAS_COMPOSITION = /\bclose-?up\b|\bwide(?: shot|-angle)?\b|\bangle\b|\bcomposition\b|\bcentered\b|\bcentred\b|\blens\b|\d+\s?mm\b|\bdepth of field\b|\bbokeh\b|\bframed\b|\bforeground\b|لقطه|زاويه|تكوين/;
const HAS_COLOUR = /\bpalette\b|\bcolou?r(?:s|ful|ed)?\b|\btones?\b|الوان|ملون|لون /;
const HAS_STYLE = /\bstyle\b|\bphoto-?realistic\b|\bcinematic\b|\bwatercolou?r\b|\banime\b|\brender\b|\billustration\b|\bpainting\b|\bvector\b/;

export function detectStyle(text: string): AnyStyle | undefined {
  const t = fold(text);
  return STYLE_WORDS.find(([, re]) => re.test(t))?.[0];
}

export function detectSubject(text: string): SubjectKind {
  const t = `${fold(text)} `;
  return SUBJECT_WORDS.find(([, re]) => re.test(t))?.[0] || 'scene';
}

/** The frame the words ask for: an explicit ratio first, then where the image will be used. */
export function detectAspect(text: string): ImageAspect | undefined {
  const t = fold(text).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const ratio = t.match(/(?<![\d.])(16|9|4|3|1)\s?[:x×/]\s?(16|9|4|3|1)(?![\d.])/);
  if (ratio && isImageAspect(`${ratio[1]}:${ratio[2]}`)) return `${ratio[1]}:${ratio[2]}` as ImageAspect;
  if (/ستوري|ريلز|حاله واتس|خلفيه (?:موبايل|تليفون|جوال|هاتف)|\bstory\b|\breels?\b|\btiktok\b|phone wallpaper|mobile wallpaper/.test(t)) return '9:16';
  if (/بانر|غلاف (?:يوتيوب|فيس|قناه)|خلفيه (?:كمبيوتر|لابتوب|سطح المكتب)|عرضي|بالعرض|بانوراما|\bbanner\b|\bdesktop\b|\bwidescreen\b|\bpanoram|\bthumbnail\b|\blandscape orientation\b|\bhorizontal\b/.test(t)) return '16:9';
  if (/بوستر|ملصق|غلاف (?:كتاب|روايه|مجله)|طولي|بالطول|\bposter\b|\bbook cover\b|\bvertical\b|\bportrait orientation\b/.test(t)) return '3:4';
  if (/مربع|صوره شخصيه للحساب|افاتار|\bsquare\b|\bavatar\b|\bprofile picture\b/.test(t)) return '1:1';
  return undefined;
}

/** Words the idea wants written on the image — only when it quoted them itself. */
export function detectLettering(text: string): { wanted: boolean; words?: string } {
  const wanted = /مكتوب|اكتب|كتابه|عباره|عنوان|بخط|\b(?:text|caption|title|lettering|typography|headline|slogan)\b|\b(?:says|saying|reads|written)\b/.test(fold(text));
  if (!wanted) return { wanted: false };
  const quoted = text.match(/[«“"]([^«»“”"\n]{1,80})[»”"]|'([^'\n]{2,80})'/);
  const words = (quoted?.[1] || quoted?.[2])?.trim();
  return words ? { wanted: true, words } : { wanted: true };
}

const CRAFTED = 'Create one original image.';
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/**
 * The brief Shaheen hands to the image engine. The idea stays in the person's own words (the engine reads
 * every language); the direction lines only cover what he did not say, so nothing he chose is overridden.
 */
export function craftImagePrompt(idea: string, choice: { style?: ImageStyleId; aspect?: ImageAspect } = {}): ImageBrief {
  const whole = clean(idea);
  // Already Shaheen's own brief (crafted in the browser or by an earlier step): never direct it twice.
  const crafted = whole.startsWith(CRAFTED);
  const text = crafted ? whole.slice(0, 3600) : whole.slice(0, 1200);
  const subject = detectSubject(text);
  const lettering = detectLettering(text);
  const chosen = choice.style && choice.style !== 'auto' ? choice.style : undefined;
  const style: AnyStyle | undefined = chosen || detectStyle(text);
  const aspect = choice.aspect || detectAspect(text) || (subject === 'scene' && !style ? undefined : SUBJECT_DIRECTION[style === 'flat' ? 'emblem' : subject].aspect);
  const base = { style: style || 'free' as const, subject, ...(aspect ? { aspect } : {}), ...(lettering.words ? { lettering: lettering.words } : {}) };
  if (crafted) return { ...base, prompt: text, enriched: false };

  const t = fold(text);
  const direction = style ? STYLE_DIRECTION[style] : undefined;
  const emblem = style === 'flat' || subject === 'emblem';
  const mood = MOODS.find(([re]) => re.test(t))?.[1];
  // A long description that already speaks of light and framing was written by an art director (Shaheen's
  // own chat brief, the studio storyboard): keep it whole and add only the guard rails.
  const directed = words(text) >= 28 && HAS_LIGHT.test(t) && (HAS_COMPOSITION.test(t) || HAS_STYLE.test(t));

  const lines: string[] = [CRAFTED, `Idea, in the person's own words (it may be in any language — understand it and follow it faithfully): «${text}»`];
  if (!directed) {
    lines.push('Art direction for whatever the idea leaves open (the idea itself always wins):');
    if (words(text) <= 7 && !emblem) lines.push('- Imagination: the idea is brief, so picture it as a specific moment — choose a fitting place and time, one small story detail and two or three telling textures. Do not change the subject or add anything the idea would contradict.');
    if (direction && (chosen || !HAS_STYLE.test(t))) lines.push(`- Style: ${direction.look}.`);
    else if (!direction) lines.push('- Style: choose the single visual style that suits this idea best and keep it consistent across the whole image.');
    if (!HAS_COMPOSITION.test(t)) lines.push(`- Composition: ${SUBJECT_DIRECTION[style === 'flat' ? 'emblem' : subject].compose}.`);
    if (!HAS_LIGHT.test(t)) lines.push(`- Lighting: ${mood || direction?.light || 'one clear motivated light source that shapes the subject, with soft believable shadows'}.`);
    else if (mood) lines.push(`- Mood: ${mood}.`);
    if (!HAS_COLOUR.test(t)) lines.push('- Colour: a limited harmonious palette of three or four colours with one accent that draws the eye to the subject.');
    if (direction) lines.push(`- Finish: ${direction.finish}.`);
  }
  lines.push('- Fidelity: keep every element the idea names — how many, which colours, where, doing what. Correct anatomy and hands, coherent perspective, no duplicated or fused objects.');
  if (aspect) lines.push(`- Frame: aspect ratio ${aspect}; compose for this shape with nothing important cut by the edges.`);
  if (lettering.words) lines.push(`- Lettering: write exactly «${lettering.words}» once, spelled letter for letter, large and legible${/[\u0600-\u06FF]/.test(lettering.words) ? ', right-to-left with correctly joined Arabic letters' : ''}. No other text.`);
  else if (lettering.wanted) lines.push('- Lettering: only the words the idea asks for, spelled exactly as given and clearly legible. No other text.');
  else lines.push('- No text: no letters, captions, numbers, watermarks, signatures, logos or frames anywhere in the image.');
  return { ...base, prompt: lines.join('\n'), enriched: !directed };
}

/** An edit keeps the picture: change the one thing that was asked and leave everything else as it is. */
export function craftEditPrompt(instruction: string): string {
  const text = clean(instruction).replace(/^edit\s*[:：-]\s*/i, '').slice(0, 800);
  const lettering = detectLettering(text);
  return [
    'Edit the attached image; return the same image with one change.',
    `The change, in the person's own words (any language): «${text}»`,
    '- Change only what is asked. Everything the change does not touch stays exactly as it is: the subject and its identity, faces, pose, framing, aspect ratio and art style. Light and colour move only as far as the change itself needs.',
    '- Blend the change in: match the existing light, shadows, perspective, grain and level of detail so the edit cannot be told from the original.',
    lettering.words ? `- Lettering: write exactly «${lettering.words}», spelled letter for letter. No other new text.` : lettering.wanted ? '- Lettering: only the words asked for, spelled exactly as given.' : '- Do not add text, watermarks or logos.',
  ].join('\n');
}

export interface ChatImageRequest { mode: 'new' | 'edit'; prompt: string }
/** The chat's ```sham-image line: «EDIT: …» means “change the picture I just drew”, anything else is a new one. */
export function parseImageRequest(line: string): ChatImageRequest {
  const edit = line.match(/^\s*edit\s*[:：-]\s*([\s\S]+)$/i);
  return edit ? { mode: 'edit', prompt: edit[1].trim() } : { mode: 'new', prompt: line.trim() };
}

/** How Shaheen writes the image line in the chat — the same craft, taught to the chat engine. */
export const IMAGE_CRAFT_INSTRUCTION = `الصور: لو طلب رسمة أو صورة مولدة أو تخيلية (وليس صورة حقيقية أو أرشيفية)، اشتغل كمخرج فني: افهم الفكرة، حافظ على كل تفصيلة قالها (العدد والألوان والأماكن والأشخاص)، وكمّل بخيالك اللي ما قالوش من غير ما تغيّر الموضوع. قول في جملة أو اتنين بلغته إيه اللي تخيلته، وبعدين اكتب في الآخر سياج \`\`\`sham-image فيه وصف إنجليزي واحد في سطر واحد (الموقع بيرسمها) بالترتيب ده: الموضوع الرئيسي وشكله وحركته، ثم المكان والوقت، ثم الأسلوب الفني (photorealistic أو cinematic أو fantasy concept art أو anime أو 3D render أو watercolor أو oil painting أو pencil sketch)، ثم الإضاءة، ثم زاوية الكاميرا والتكوين، ثم الألوان والمزاج، ثم المقاس المناسب للاستخدام (1:1 أو 3:4 أو 4:3 أو 9:16 للستوري أو 16:9 للخلفيات).
لو عايز كلام مكتوب على الصورة حط الكلام نفسه بحروفه بين علامتي تنصيص، وغير كده ما تطلبش كتابة. ما تكتبش اسم فنان حي أو علامة تجارية أو شخصية محمية كأسلوب؛ اوصف صفات الأسلوب نفسها. لو الطلب ناقص ارسم أحسن تخيل ليه وبعدها اعرض تعديل واحد أو اتنين (الأسلوب، الإضاءة، المقاس) — ما توقفش الرسم علشان تسأل.
تعديل صورة: لو طلب تغيير في آخر صورة رسمتها (خلّيها ليل، غيّر الخلفية، شيل أو ضيف حاجة، غيّر اللون)، اكتب نفس السياج والوصف يبدأ بـ EDIT: وبعدها التغيير المطلوب بس بالإنجليزي؛ الموقع بيعدّل نفس الصورة وما بيرسمش من الأول. لو طلب صورة مختلفة خالص اكتب وصف جديد كامل من غير EDIT.`;
