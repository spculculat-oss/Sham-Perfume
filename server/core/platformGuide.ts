/**
 * «دليل المنصة» — كل ميزة بيشوفها الزائر في منصة شام في مكان واحد، بالمصدر اللي الكود نفسه بيستخدمه:
 *
 *  - `PLATFORM_FEATURES`: الاسم، الشرح المختصر، طريقة الاستخدام، تبويب الموقع اللي بيفتحها، وكلمات البحث.
 *  - `platformKnowledge()`: مستندات قاعدة المعرفة اللي بتتزرع أول مرة، فالمساعد يرد بالاسترجاع حتى من غير
 *    أي مفتاح ذكاء اصطناعي ويقدر يعرض المرجع.
 *  - `matchPlatformFeature()`: يعرف الزائر بيسأل عن أنهي ميزة بالعربي أو الإنجليزي، فيرد رد مباشر
 *    ويعرض زر «افتح الصفحة» بدل ما يضيّع الزائر يدوّر على التبويب.
 *  - `platformCatalog()` و`shippingBrief()`: كتالوج مختصر + جدول الشحن الحقيقي يتضافوا لبرومبت النموذج
 *    عند كل سؤال، فأي تحديث هنا بيوصل للمساعد فوراً من غير ما يتخزن في مكان تاني.
 *
 * القاعدة: مفيش رقم أو وعد متخيّن. الأسعار والمخزون والمواعيد بتيجي من بيانات المنصة بس، واللي مش
 * متأكدين منه بنقول إن فريق شام هو اللي بيأكده.
 */
import { matchesKeyword, normalize } from './text';
import { SHIPPING } from '../../src/utils/pricing';
import { SUPPORTED_LANGUAGES } from '../../src/types/i18n';
import type { KnowledgeDoc } from './types';

export type PlatformGroup = 'lab' | 'reference' | 'workspace' | 'community' | 'shop' | 'help';

export interface PlatformFeature {
  id: string;
  group: PlatformGroup;
  /** Tab id in src/App.tsx; the open_tab card navigates there. Omitted when there is no visitor tab. */
  tab?: string;
  /** Knowledge document id: an existing curated doc, or one of the platform docs created below. */
  docId: string;
  name: { ar: string; en: string };
  /** The direct answer: one sentence. */
  summary: { ar: string; en: string };
  /** How to use it, and its honest limits. */
  details: { ar: string; en: string };
  /** Arabic and English search words (whole-word, inflections tolerated by matchesKeyword). */
  keywords: string[];
  tags: string[];
}

export const PLATFORM_GROUP_LABEL: Record<PlatformGroup, { ar: string; en: string }> = {
  lab: { ar: 'أدوات المعمل والحاسبات', en: 'Lab tools & calculators' },
  reference: { ar: 'المكتبات والمراجع', en: 'Libraries & references' },
  workspace: { ar: 'دفتر الوصفات والخبراء', en: 'Your formulas & experts' },
  community: { ar: 'المجتمع والحساب', en: 'Community & account' },
  shop: { ar: 'المتجر والخدمات', en: 'Store & services' },
  help: { ar: 'الخصوصية والقانون والمساعدة', en: 'Privacy, legal & help' },
};

/**
 * ترتيب الميزات هو ترتيب عرضها في «دليل المنصة» والاقتراحات. كل شرح مكتوب من الكود الفعلي للمنصة،
 * وأي ميزة بتتغيّر لازم تتغيّر هنا معاها (اختبار tests/shamCorePlatform.test.ts بيحرس التبويبات).
 */
export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    id: 'block_tools', group: 'workspace', tab: 'workspace', docId: 'kb-platform-block-tools',
    name: { ar: 'مصنع أدوات شاهين بالبلوكات', en: 'Shaheen block tool workshop' },
    summary: { ar: 'يركّب أدوات محلية من مدخلات وحسابات وشروط ومعالجة قوائم ونصوص، مع تشغيل وفحص وحفظ التعريف على الجهاز.', en: 'Assemble local input, arithmetic, condition, list and text tools, with validation, execution and device-local definitions.' },
    details: { ar: 'افتح مساحة شاهين ثم بلوكات. اختر مثالاً أو اطلب بناء حاسبة خصم أو تركيز أو تنظيف نص أو تربيع قائمة أو شرط نجاح. الطلب المحلي يركّب الأمثلة الخمسة فقط؛ الأدوات الأخرى تتطلب تعريف JSON صريحاً باستخدام العمليات المسموحة، ويمكن طلب تصميم التعريف من المحرك المهيأ بزر صمّم أداة جديدة بالوصف عند توافر الخدمة والحصة. الوصف فقط يرسل للتصميم؛ التشغيل يظل محلياً ويمنع أي تعريف غير صالح أو لا يعمل بقيمه الافتراضية. فحص القيم الافتراضية لا يثبت صحة منطق الأداة لكل المدخلات. عدّل تعريف inputs وnodes وoutputs واضغط افحص وطبّق، ثم غيّر المدخلات وشغّل. يمكن لشات شاهين توليد تعريف للأمثلة عند طلب بنائها بالبلوكات، وفي شات مساحة العمل يظهر زر افتح في البلوكات. يوجد استيراد وتصدير JSON وحفظ واسترجاع على نفس الجهاز فقط، لا مزامنة حساب. المفسر يمنع الشبكة والملفات والأسرار وأوامر النظام والنشر، ويحد حجم البرنامج والتكرار والخطوات. مسارات اللغات مواد تعليمية وليست مفسرات مثبتة أو إتقان كل علوم البرمجة. النشر أو إضافة موصل جديد يحتاج مراجعة واختبارات وموافقة المالك. أمثلة الحساب عامة وليست حاسبة فواتير أو دفع رسمي.', en: 'Open Shaheen Workspace → Blocks. Select an example or ask for a discount or concentration calculator, text cleanup, list squares or a pass/fail condition. Local request assembly covers those five templates only; other tools require explicit JSON using allowed operations. An optional online drafting button asks the configured engine for a new definition when service and quota are available, sending only the description from this UI. Invalid definitions or failed default-input runs are rejected. This is not independent verification of the requested semantics or all possible inputs. Edit inputs, nodes and outputs, validate/apply, change inputs and run. Shaheen chat can generate example definitions on explicit block-building requests; Workspace chat offers Open in blocks. JSON import/export and save/restore are device-only, not account sync. The interpreter has no network, files, secrets, shell or deployment and caps program size, repetition and steps. Language paths are educational, not installed compilers or mastery of all programming science. Deployment or a new connector requires review, tests and owner approval. Calculations are general tools, not official billing or payment calculators.' },
    keywords: ['بلوكات برمجية', 'مصنع أدوات', 'بناء أدوات بالبلوكات', 'مصنع أدوات شاهين', 'block tool', 'block programming', 'tool workshop'],
    tags: ['بلوكات', 'برمجة', 'أدوات', 'blocks', 'programming'],
  },
  {
    id: 'real_photos', group: 'workspace', tab: 'workspace', docId: 'kb-platform-real-photos',
    name: { ar: 'الصور الحقيقية بمصدرها', en: 'Sourced real-photo search' },
    summary: { ar: 'طلب صورة فوتوغرافية أو أرشيفية يستخدم بحث الصور لا توليد الرسومات.', en: 'Real or archival photograph requests use sourced image search, not image generation.' },
    details: { ar: 'في شات شاهين ومساحة العمل وتبويب الصور، طلب مثل عايظ صورة حقيقيه لحسنى مبارك يحضر طلب بحث Hosni Mubarak عبر مسار الصور الموجود دون مفتاح توليد. تعرض الصور المنشورة مع رابط صفحة المصدر والترخيص واسم المصور المتاح، ولا نضيف توقيع sharing ai على الصور الأرشيفية. تظهر رسالة إن تعذر البحث أو لم توجد نتيجة مطابقة. البيانات التي تصف رسماً أو تمثالاً أو صورة مولدة تستبعد من نمط الصور الفوتوغرافية. هذه مرشحات نصية وليست تحققاً بصرياً مستقلاً لهوية الصورة أو تاريخها، وليس كل موضوع له صور مرخصة متاحة. التوليد يبقى للرسومات المطلوبة صراحة ولا يستعمل بديلاً صامتاً للصورة الحقيقية.', en: 'In Shaheen chat, Workspace chat and Images, requests such as a real photograph of Hosni Mubarak prepare a Hosni Mubarak image lookup through the existing media service without an image-generation key. Published images retain the source page, license and available photographer credit, without a sharing ai overlay. Missing results or failed lookups show a notice. Explicit artwork, statue and AI-generated metadata are excluded in photograph mode. Textual filtering is not independent visual identity/date authentication; licensed results are not guaranteed for every subject. Artwork generation is separate and never a silent fallback for real photographs.' },
    keywords: ['صورة حقيقية', 'صورة أرشيفية', 'حسني مبارك', 'real photo', 'archival photograph', 'Hosni Mubarak'],
    tags: ['صور', 'مصدر', 'ترخيص', 'photograph', 'source'],
  },
  {
    id: 'conversation_context', group: 'workspace', tab: 'master_ai', docId: 'kb-platform-conversation-context',
    name: { ar: 'ربط متابعة المحادثة والصور', en: 'Conversation and illustration continuity' },
    summary: { ar: 'متابعة الصور والشرح والمقارنة تستند إلى السؤال والجواب القريبين، مع احترام تغيير الموضوع.', en: 'Elliptical illustration, explanation and comparison requests carry recent conversation context and respect topic changes.' },
    details: { ar: 'بعد شرح عيوب اللحام، طلب هاتلي صور توضيحية يحمل السؤال والجواب السابقين إلى المحرك بدلاً من طلب صور بلا موضوع. يعمل الربط المحدود داخل المحادثة في شاهين ومساحة العمل ووضع الأدوات؛ لا ذاكرة مشتركة بين الزوار ولا تدريب تلقائي للنموذج. إذا لم يوجد مرجع يسأل عن الموضوع، وعند تغيير الموضوع يتبع الجديد. بحث الصور يحتفظ بكل الصفات الأساسية ويرفض نتائج عنوانها غير مطابق بدلاً من حذف الكلمات وتوسيع البحث؛ قد لا يجد صوراً. مطابقة العناوين ليست فحصاً بصرياً ولا ضماناً للدقة الفنية، والصور المولدة توضيحية لا دليل فحص حقيقي. جودة الفهم النهائي مرتبطة بالمحرك المتاح وليست ضماناً لإدراك بشري أو ذكاء مطلق.', en: 'After discussing welding defects, show me illustrations carries the recent question and answer to the model. Bounded per-conversation references work in Shaheen, Workspace and tool mode; there is no shared visitor memory or automatic model training. Missing references require clarification; explicit new subjects take priority. Image searches preserve qualifiers and reject non-matching titles instead of dropping words, so results may be empty. Title matching is not visual inspection or a technical accuracy guarantee. Generated illustrations are not inspection evidence. Final reasoning depends on the available model.' },
    keywords: ['ربط المواضيع', 'صور توضيحية', 'عيوب اللحام', 'سياق المحادثة', 'conversation context', 'follow up'],
    tags: ['شاهين', 'سياق', 'صور', 'context', 'illustration'],
  },
  {
    id: 'workspace_motion', group: 'workspace', tab: 'workspace', docId: 'kb-platform-workspace-motion',
    name: { ar: 'تحريك صور شاهين وتوقيعها', en: 'Shahin signed image animation' },
    summary: { ar: 'توقيع sharing ai على معاينة وتصدير الصور، وتحريك تقريب وكاميرا محلي مع تنزيل فيديو قصير.', en: 'The sharing ai signature on image exports, with local pan/zoom animation and short video downloads.' },
    details: { ar: 'توليد الصور تحت علامة sharing ai يستخدم الخدمة المهيأة فقط؛ لا رجوع تلقائي لمولّد خارجي ولا إخفاء لحقوق مدمجة. غياب الخدمة أو الحصة يظهر تعذراً ولا صورة وهمية. في مساحة شاهين، اطلب تحريك الصورة الموجودة أو افتح تبويب صور وارفع صورة، ثم اضغط عمل فيديو متحرك، وانتظر التسجيل وتنزيله. الفيديو بلا صوت، بصيغة يدعمها المتصفح (WebM أو MP4)، وليس توليد حركة أشخاص أو فيديو جديد بالذكاء الاصطناعي، ولا GIF. التصدير محلي ولا يحتاج مفتاح فيديو، لكن توليد الصورة الأساسية قد يحتاج خدمة وصلاحية وحصة. لا نزيل أي علامة حقوق أو منشأ مدمجة أصلاً، وsharing ai توقيع شام المضاف وليس دليلاً على مصدر النموذج. فشل تحميل الصورة أو CORS أو عدم دعم التسجيل يظهر خطأ دون نجاح وهمي.', en: 'Generated previews and exports use sharing ai branding with the configured service only; there is no automatic external generator fallback or removal of embedded rights marks. Missing service/quota fails honestly. In Shahin Workspace, request motion for an existing image, or upload an image in Images. Select Create motion clip, wait for recording, then download. Silent video uses a browser-supported WebM or MP4 format; it is pan/zoom, not new AI scene/character motion or GIF. Export is local and needs no video key; initial image generation may need a configured service and quota. Existing rights/provenance marks are not removed. sharing ai is added Sham branding, not proof of model origin. Loading, CORS and recording failures are reported without false success.' },
    keywords: ['فيديو متحرك', 'تحريك الصورة', 'توقيع شاهين', 'sharing ai', 'animated video', 'image animation', 'motion clip'],
    tags: ['صور', 'حركة', 'فيديو', 'images', 'animation'],
  },
  {
    id: 'imagination_images', group: 'workspace', tab: 'workspace', docId: 'kb-platform-imagination',
    name: { ar: 'الصور التخيلية بخيال شاهين', en: 'Shaheen imaginative images' },
    summary: { ar: 'اكتب فكرة بسيطة بأي لغة، وشاهين يتخيّل الباقي (المكان والإضاءة والتكوين والألوان) ويرسمها بالأسلوب والمقاس اللي تختاره، وتعدّلها بالكلام.', en: 'Write a simple idea in any language; Shaheen imagines the rest (setting, light, composition, colour), draws it in the style and shape you choose, and edits it from your words.' },
    details: { ar: 'افتح مساحة شاهين ثم تبويب صور، واكتب الفكرة ببساطة مثل قطة في الفضاء. اختر الأسلوب: شاهين يختار، واقعي، سينمائي، خيالي، أنمي، كرتون مجسّم، ألوان مائية، لوحة زيتية أو رسم بالرصاص. واختر المقاس: مربع، طولي، عرضي، ستوري للموبايل أو خلفية عريضة، ثم اضغط ارسم. شاهين يحافظ على كل تفصيلة كتبتها ويكمّل الناقص فقط، ولا يكتب كلاماً على الصورة إلا لو طلبت وكتبت النص بين علامتي تنصيص. بعد الرسم اطلب التعديل بالكلام (خلّيها ليل، غيّر الخلفية) فيتغيّر المطلوب فقط وتبقى باقي الصورة، وفي المحادثة اطلب الصورة ثم اطلب تعديلها بنفس الطريقة. الحدود بصراحة: الرسم يحتاج خدمة الصور مهيأة وحصتها متاحة، ولو غير متاحة تظهر رسالة تعذر ولا تظهر صورة وهمية؛ الحروف العربية الطويلة قد لا تخرج دقيقة فاكتب العبارات القصيرة أو أضف النص من أداة الكتابة على الصورة؛ طلب صورة حقيقية أو أرشيفية يذهب لبحث الصور لا للرسم؛ وكل صورة مرسومة تحمل توقيع sharing ai.', en: 'Open Shaheen Workspace, then Images, and write the idea simply, e.g. a cat in space. Pick a style: Shaheen decides, realistic, cinematic, fantasy, anime, 3D cartoon, watercolour, oil painting or pencil sketch. Pick a shape: square, portrait, landscape, phone story or wide screen, then press Generate. Shaheen keeps every detail you wrote and fills in only what is missing; it letters words on the image only when you ask and quote them. Afterwards ask for a change in words (make it night, change the background): only that changes and the rest of the image stays. In the chat, ask for an image and then ask to change it the same way. Honest limits: drawing needs the image service to be configured with quota left, otherwise an unavailable message is shown and never a fake image; long Arabic lettering may come out inexact, so keep phrases short or add the words with the text-on-image tool; a real or archival photo request goes to image search, not drawing; every drawn image carries the sharing ai signature.' },
    keywords: ['صورة تخيلية', 'صور تخيلية', 'ارسم صورة', 'تصميم صورة', 'توليد صور', 'أسلوب الصورة', 'مقاس الصورة', 'imaginative image', 'generate an image', 'image style', 'draw a picture', 'ai image'],
    tags: ['صور', 'تخيل', 'رسم', 'تصميم', 'images', 'imagination', 'drawing'],
  },
  {
    id: 'shaheen_painter', group: 'workspace', tab: 'workspace', docId: 'kb-platform-painter',
    name: { ar: 'مرسم شاهين الخاص', en: 'Shaheen own painter' },
    summary: { ar: 'لو خدمة الصور المتقدمة مش متاحة، شاهين بيرسم الفكرة بمرسمه الخاص على جهازك: رسم توضيحي مبسّط مش صورة واقعية، وبيقول كده تحت الرسمة.', en: 'When the advanced image service is unavailable, Shaheen draws the idea with his own painter on your device: a simple illustration, not a realistic image, and the note under the picture says so.' },
    details: { ar: 'مرسم شاهين بيشتغل تلقائياً في شات اسأل شاهين وفي مساحة شاهين وتبويب صور لما خدمة الصور المتقدمة تكون مش متاحة أو حصتها خلصت. بيعرف يرسم: الفضاء والنجوم، الصحراء، البحر، الجبال، الغابة، المدينة، الحديقة وسطح استوديو، في الليل أو الغروب أو الفجر أو النهار، ومعاها زجاجة عطر، ورد، صقر، قطة، جمال، نخيل، فانوس، مسجد، مركب أو شخص واقف، بالألوان والأسلوب اللي تطلبه. لو العنصر الرئيسي مش من الحاجات دي (زي حصان أو سيارة أو وجه واقعي أو أكل) بيرسم المكان والجو بس ويقول بصراحة إن العنصر ناقص. الصور الواقعية وتعديل صورة بالكلام محتاجين خدمة الصور المتقدمة.', en: 'Shaheen own painter works automatically in the Ask Shaheen chat and in the workspace Images tab when the advanced image service is unavailable or out of quota. It can draw space and stars, desert, sea, mountains, forest, city, garden and a studio surface, at night, sunset, dawn or day, with a perfume bottle, roses, a falcon, a cat, camels, palms, a lantern, a mosque, a boat or a standing figure, in the colours and style you ask for. If the main subject is not one of these (a horse, a car, a realistic face, food) it draws the place and mood only and says plainly what is missing. Realistic images and editing a picture from words need the advanced image service.' },
    keywords: ['مرسم شاهين', 'رسم توضيحي', 'الرسم من غير خدمة الصور', 'شاهين بيرسم بنفسه', 'own painter', 'simple illustration', 'offline drawing'],
    tags: ['صور', 'رسم', 'مرسم', 'images', 'painter', 'illustration'],
  },
  {
    id: 'shaheen_painter_wonders', group: 'workspace', tab: 'workspace', docId: 'kb-platform-painter-wonders',
    name: { ar: 'خيال مرسم شاهين والجرافيك', en: 'Shaheen painter imagination and graphics' },
    summary: { ar: 'مرسم شاهين بقى يتخيّل ويضيف من عنده: أشعة ضوء، ضباب بين الجبال، درب التبانة، شفق قطبي، شهب، كواكب بحلقات وجزر طائرة، وبيرسم عناصر خيالية جديدة زي التنين والقلعة والأهرامات.', en: 'Shaheen own painter now imagines and adds on its own: light rays, haze between mountains, the milky way, aurora, shooting stars, ringed planets and floating islands, and draws new imaginative subjects such as a dragon, a castle and the pyramids.' },
    details: { ar: 'العناصر الجديدة اللي مرسم شاهين بيرسمها: تنين (واكتب ينفث النار لو عايز لهب)، حصان، حوت، أهرامات، قلعة أو قصر، فنار، مناطيد، جزر طائرة، شلال، كوكب بحلقات، كريستال، فراشات وشجرة كبيرة. ولو كتبت كلمة زي خيالي أو سحري أو حلم، شاهين بيضيف من خياله جزر طائرة وكوكب في السما وغبار مضيء، وبالليل قمر عملاق وشفق قطبي ويراعات. كل مشهد بياخد إضاءة وعمق تلقائي: أشعة شمس وقت الغروب والفجر، ضباب بين الطبقات، قمم جبال بالثلج، درب التبانة والشهب بالليل. تقدر تطلبها بالاسم: شفق قطبي، قمر عملاق، شهاب، يراعات. الرسم لسه توضيحي مش واقعي، وبيتكتب تحت الرسمة.', en: 'New subjects Shaheen own painter draws: a dragon (write breathing fire for flames), a horse, a whale, the pyramids, a castle or palace, a lighthouse, hot-air balloons, floating islands, a waterfall, a ringed planet, crystals, butterflies and a great tree. If you write a word such as fantasy, magic or dream, Shaheen adds from his imagination floating islands, a planet in the sky and glowing dust, and at night a giant moon, aurora and fireflies. Every scene gets automatic light and depth: sun rays at sunset and dawn, haze between layers, snow peaks, the milky way and shooting stars at night. You can ask by name: aurora, giant moon, shooting star, fireflies. The drawing is still an illustration, not a realistic image, and the note under it says so.' },
    keywords: ['خيال المرسم', 'جزر طائرة', 'شفق قطبي', 'قمر عملاق', 'ارسم تنين', 'جرافيك مبهر', 'floating islands', 'aurora drawing', 'painter imagination'],
    tags: ['صور', 'رسم', 'خيال', 'جرافيك', 'images', 'painter', 'imagination'],
  },
  {
    id: 'shaheen_painter_studio', group: 'workspace', tab: 'workspace', docId: 'kb-platform-painter-studio',
    name: { ar: 'استوديو مرسم شاهين: تخمين وواقعية وأدوات', en: 'Shaheen painter studio: guessing, realism and tools' },
    summary: { ar: 'مرسم شاهين بقى يخمّن المقصود من كلمة واحدة (رمضان، الشتاء، الهدوء، عطر منعش)، وبيرسم بملمس أقرب للحقيقة (سحاب وصخر ورمل ومية)، ومعاه أدوات: رسمة تانية، تحميل بجودة عالية، ملف للطباعة وفيديو بعمق.', en: 'Shaheen own painter now guesses what one word means (Ramadan, winter, calm, a fresh scent), draws with textures closer to real (clouds, rock, sand, water), and has tools: another take, high-quality download, a print file and a clip with depth.' },
    details: { ar: 'التخمين: لو الفكرة ما فيهاش مكان ولا عنصر، شاهين بيفهمها من المناسبة أو الفصل أو الإحساس أو نوتة العطر. رمضان يبقى مسجد وفانوس بالليل، مصر تبقى أهرامات ونخيل، الشتاء جبال وثلج، الربيع حديقة وفراشات، الهدوء بحر وقت الفجر، مرعب غابة وقلعة في الضباب، عود وبخور زجاجة عطر ودخان، عطر منعش زجاجة على البحر. وأي حاجة تكتبها صريحة بتكسب على التخمين. تقدر كمان تكتب عدد (ثلاث أحصنة) أو حجم (عملاق، صغير). الواقعية: السحاب والصخر والرمل والمية والعشب ليهم ملمس حقيقي وإضاءة من ناحية الشمس، والعناصر ليها حجم وظل. الأدوات تحت أي رسمة من المرسم: رسمة تانية لنفس الفكرة، تحميل بجودة عالية بضعف الحجم، ملف SVG للطباعة بأي مقاس، وعمل فيديو متحرك بعمق (الخلفية والعناصر بيتحركوا بسرعات مختلفة). لسه رسم مش تصوير: الصور الفوتوغرافية وتوليد فيديو جديد محتاجين خدمة الصور المتقدمة.', en: 'Guessing: when the idea names no place or thing, Shaheen reads the occasion, season, mood or scent note. Ramadan becomes a mosque and a lantern at night, Egypt becomes pyramids and palms, winter becomes snowy mountains, spring a garden with butterflies, calm a sea at dawn, scary a forest and a castle in fog, oud and incense a perfume bottle with smoke, a fresh scent a bottle by the sea. Anything you write plainly wins over the guess. You can also write a number (three horses) or a size (giant, small). Realism: clouds, rock, sand, water and grass have real texture lit from the sun side, and subjects have volume and shadow. Tools under any picture from the painter: another take of the same idea, a high-quality download at twice the size, an SVG print file for any size, and a motion clip with depth (the background and the subjects move at different speeds). It is still drawing, not photography: photographic images and generating new video need the advanced image service.' },
    keywords: ['تخمين شاهين', 'صورة عن رمضان', 'ملمس واقعي', 'تحميل بجودة عالية', 'ملف للطباعة', 'فيديو بعمق', 'رسمة تانية', 'painter tools', 'high quality download', 'print file'],
    tags: ['صور', 'رسم', 'تخمين', 'أدوات', 'فيديو', 'images', 'painter', 'tools'],
  },
  {
    id: 'shaheen_live_chat', group: 'workspace', tab: 'workspace', docId: 'kb-platform-live-chat',
    name: { ar: 'رد شاهين بيتكتب قدامك والأخبار ببحث حي', en: 'Shaheen writes live, with today’s news' },
    summary: { ar: 'في مساحة شاهين الرد بيظهر كلمة كلمة وهو بيتكتب بدل ما تستنى في صمت، وأسئلة الأخبار والطقس والحاجات اللي بتتغير كل يوم بتتبحث في الويب لوحدها ويظهر معاها المصادر.', en: 'In Shaheen’s workspace the reply appears word by word as it is written instead of after a silent wait, and news, price and weather questions search the web by themselves and show their sources.' },
    details: { ar: 'تحت الرسالة بيظهر سطر حي يقول شاهين بيعمل إيه (بدوّر في الويب، بفكّر بعمق، برسم الصورة، أو بكتب الرد)، والمصادر بتظهر كشرائح واضحة أول ما توصل قبل ما الكتابة تخلص. شاشة المعلومات واللوحة الجانبية بتعرض لحظة بلحظة أهم النقاط والأرقام البارزة والجداول والمعاينة الحية للكود والمصادر، وفي وضع التحدث الصوتي والاستماع بتظهر لوحة المعلومات الحية وكلامك اللي بتقوله وتظلّل الجملة والنقطة اللي شاهين بينطقها دلوقتي من كلام الرد الحقيقي فقط من غير أي اختراع. سجل المحادثات محفوظ على جهازك في القائمة الجانبية مع بحث وحذف، ومعاه الوضع الفاتح والداكن وملء الشاشة. زر «إيقاف» بيوقف الكتابة ويسيب اللي اتكتب، ولو كل المنصات مش متاحة وسؤالك عن خبر شاهين بيعرض اللي لقاه بمصادره أو السبب الحقيقي للتعذر. زر «اسمع» ما بيقراش أرقام المصادر ولا الكلام المشطوب.', en: 'A live status line shows what Shaheen is doing (searching the web, thinking deeply, drawing, or writing), and web sources appear as clickable chips the moment they arrive. The Live Info & Canvas side panel extracts and updates key points, figures, tables, live code previews and sources in real time from the actual reply without inventing anything; during voice conversation and read-aloud, a companion live board shows your live words and highlights the exact sentence and point Shaheen is speaking right now. A collapsible sidebar keeps your conversation history locally on your device with search and delete, alongside light/dark modes and full-screen focus. The Stop button stops writing and keeps what arrived so far; if every engine is unavailable, news queries show found sources and other queries state the real reason. The Listen button skips citation numbers and crossed-out text.' },
    keywords: ['آخر الأخبار', 'الرد بيتكتب', 'شاشة المعلومات', 'سجل المحادثات', 'المنصات مشغولة', 'بحث في الويب', 'live reply', 'live info', 'canvas', 'today news', 'web search'],
    tags: ['شات', 'أخبار', 'بحث', 'مساحة شاهين', 'chat', 'news', 'search'],
  },
  {
    id: 'concentration', group: 'lab', tab: 'concentration', docId: 'kb-concentration',
    name: { ar: 'حاسبة التركيز', en: 'Concentration calculator' },
    summary: {
      ar: 'تحسب مقادير الزيت العطري والكحول والماء والمثبت حسب حجم الزجاجة ونسبة التركيز.',
      en: 'Calculates the fragrance oil, alcohol, water and fixative amounts for a bottle size and concentration.',
    },
    details: {
      ar: 'اختار حجم الزجاجة ونوع التركيز (كولونيا أو EDT أو EDP أو بارفان) وبتظهر المقادير بالمل والجرام، ومعاها محاكي ميزان دقيق 0.01 جم وزر لنقل النتيجة لحاسبة التكاليف.',
      en: 'Pick the bottle size and concentration (cologne, EDT, EDP or parfum); amounts appear in ml and grams, with a 0.01 g balance simulator and a button that sends the result to the costing calculator.',
    },
    keywords: ['حاسبة التركيز', 'حاسبة التركيب', 'نسبة التركيز', 'تركيز العطر', 'concentration calculator', 'concentration'],
    tags: ['تركيز', 'حاسبة', 'concentration', 'calculator'],
  },
  {
    id: 'pyramid', group: 'lab', tab: 'pyramid', docId: 'kb-pyramid',
    name: { ar: 'حاسبة الهرم العطري', en: 'Fragrance pyramid calculator' },
    summary: {
      ar: 'توزّع نوتات العطر على القمة والقلب والقاعدة وتتأكد أن مجموعها 100%.',
      en: 'Splits the notes across top, heart and base and checks that they add up to 100%.',
    },
    details: {
      ar: 'ضيف النوتات بنسبها لكل طبقة، والحاسبة بتحذّرك لو المجموع مش 100%، وفيها محاكي رش يوضح إزاي العطر بيتطور على الجلد مع الوقت.',
      en: 'Add notes with their share of each layer; it warns you when the total is not 100%, and a spray simulator shows how the scent develops on skin over time.',
    },
    keywords: ['الهرم العطري', 'حاسبة الهرم', 'النوتات العطرية', 'fragrance pyramid', 'pyramid calculator'],
    tags: ['هرم', 'نوتات', 'pyramid', 'notes'],
  },
  {
    id: 'alcohol', group: 'lab', tab: 'alcohol', docId: 'kb-alcohol',
    name: { ar: 'حاسبة تخفيف الكحول', en: 'Alcohol dilution calculator' },
    summary: {
      ar: 'تحسب كمية الماء المقطر اللازمة لتخفيف كحول بدرجة معيّنة إلى الدرجة اللي تحتاجها.',
      en: 'Calculates the distilled water needed to dilute alcohol from one strength to the strength you need.',
    },
    details: {
      ar: 'اكتب الدرجة الحالية والدرجة المطلوبة والحجم، والنتيجة تقديرية بالحجم لأن خلط الكحول والماء بينكمش شوية.',
      en: 'Enter the current strength, the target strength and the volume. The result is a volume estimate because alcohol and water contract slightly when mixed.',
    },
    keywords: ['تخفيف الكحول', 'حاسبة الكحول', 'درجة الكحول', 'alcohol dilution', 'dilution calculator'],
    tags: ['كحول', 'تخفيف', 'alcohol', 'dilution'],
  },
  {
    id: 'costing', group: 'lab', tab: 'costing', docId: 'kb-costing',
    name: { ar: 'حاسبة التكاليف والتسعير', en: 'Costing & pricing calculator' },
    summary: {
      ar: 'تجمع تكلفة الزيوت والكحول والعبوة والتغليف والتشغيل وتقترح سعر بيع حسب هامش الربح.',
      en: 'Adds up oils, alcohol, bottle, packaging and labour, then suggests a selling price for your target margin.',
    },
    details: {
      ar: 'بتشتغل بعملة بلدك المختارة في إعدادات المنصة، وتقدر تجيب الكميات مباشرة من حاسبة التركيز بدل ما تكتبها تاني.',
      en: 'It uses the country currency chosen in the site settings, and can pull the quantities straight from the concentration calculator.',
    },
    keywords: ['حاسبة التكاليف', 'تسعير العطر', 'تكلفة العطر', 'هامش الربح', 'costing calculator', 'pricing'],
    tags: ['تكلفة', 'تسعير', 'cost', 'pricing'],
  },
  {
    id: 'engineering_calculator', group: 'lab', tab: 'home', docId: 'kb-platform-calculator-live',
    name: { ar: 'الحاسبة الهندسية العائمة', en: 'Floating engineering calculator' },
    summary: { ar: 'حاسبة عادية وعلمية من بطاقة الساعة في الرئيسية، تقدر تحرّكها وتصغّرها وتكمّل تصفّح الموقع.', en: 'A movable, minimizable calculator with Standard and Scientific modes in the home clock card.' },
    details: {
      ar: 'من بطاقة الساعة في الرئيسية اضغط «حاسبة هندسية» جنب البوصلة. بتبدأ في «حساب عادي» بالترتيب، وتقدر تختار «حساب علمي» للأولوية والأقواس. اسحب شريط النافذة العلوي للتحريك. في الحساب العلمي والأعداد المركّبة النتيجة بتظهر تلقائي أول ما التعبير يكون صالح؛ EXE أو Enter بيثبّتها في Ans والسجل. العمليات العشوائية والحسابات التقيلة بتستنى EXE. افتح HOME للمصفوفات والمتجهات والمعادلات والإحصاء والمتباينات والتوزيعات وأنظمة العدّ والتناسب والجداول والمحاكاة وتحويل الوحدات. زر FORMAT يغيّر عرض الناتج وCATALOG يفتح الدوال والثوابت. الحساب على جهازك؛ الحلول العددية تقريبية، ودي حاسبة ويب مش برنامج كاسيو.',
      en: 'In the home clock card, open Engineering calculator beside the compass and drag its title bar to move it. It starts in Standard (key-entry order); switch to Scientific for precedence and parentheses. Scientific and Complex show live results for valid expressions. EXE or Enter commits the answer to Ans and history; random and expensive calculations wait for EXE. Use HOME for matrices, vectors, equations, statistics, inequalities, distributions, number bases, ratios, tables, spreadsheets, simulations and unit conversion. FORMAT changes the readout and CATALOG lists functions and constants. Calculations run on your device; numerical solutions are approximate. This is a web calculator, not Casio firmware.',
    },
    keywords: ['حاسبة هندسية', 'الحاسبة الهندسية', 'حاسبة الساعة', 'الة حاسبة كاسيو', 'engineering calculator', 'scientific calculator', 'clock calculator', 'classwiz'],
    tags: ['حاسبة هندسية', 'الساعة', 'engineering calculator', 'scientific calculator'],
  },
  {
    id: 'calculator_standard', group: 'lab', tab: 'home', docId: 'kb-platform-calculator-standard',
    name: { ar: 'الحساب العادي بالترتيب', en: 'Standard desk calculator' },
    summary: { ar: 'حاسبة الساعة بتفتح على «حساب عادي»: الجمع والطرح والضرب والقسمة بالترتيب اللي ضغطت بيه، والناتج عشري.', en: 'The clock calculator opens in Standard: addition, subtraction, multiplication and division in key-entry order, with decimal results.' },
    details: {
      ar: 'افتح الحاسبة الهندسية من بطاقة الساعة. في «حساب عادي»، لو ضغطت ٧٧ − ١٥ ÷ هتشوف ٦٢ كناتج مرحلي؛ كمّل ١٠٠ واضغط = فتطلع ٠٫٦٢. ينفع تكتب التعبير أو تلصقه بالأرقام العربية أو اللاتينية. اختار «حساب علمي» من أعلى النافذة لو عايز أولوية العمليات والأقواس والدوال؛ نفس التعبير هناك يطلع ٧٦٫٨٥ لأن القسمة بتتحسب أولًا. الحساب العادي مش محاكاة لكل أزرار موديل بعينه.',
      en: 'Open the engineering calculator from the clock card. In Standard, pressing 77 − 15 ÷ shows 62 as the subtotal; enter 100 and press = for 0.62. You can also type or paste the expression with Arabic or Latin digits. Choose Scientific at the top for precedence, parentheses and functions; the same expression there gives 76.85 because division goes first. Standard mode does not emulate every key of a particular device.',
    },
    keywords: ['حساب عادي', 'الحساب العادي', 'حاسبة عادية', 'الحساب بالترتيب', 'الآلة الخارجية', 'standard calculator', 'desk calculator', 'key-entry order', 'sequential calculator'],
    tags: ['حساب عادي', 'الحاسبة', 'standard calculator'],
  },
  {
    id: 'calculator_study', group: 'lab', tab: 'home', docId: 'kb-platform-calculator-study',
    name: { ar: 'الرسم وشاهين للمذاكرة في الحاسبة', en: 'Graphing and Shaheen Study' },
    summary: { ar: 'اختار «رسم الدوال» أو «شاهين للمذاكرة» من HOME في الحاسبة الهندسية جنب بوصلة الرئيسية.', en: 'Open Graph or Shaheen Study from HOME in the engineering calculator beside the home compass.' },
    details: {
      ar: 'من «رسم الدوال» ارسم ديكارتي أو قطبي أو بارامتري، وحرّك نقطة التتبّع. تحليل الديكارتي للجذور والتقاطع والتكامل عددي وتقريبي. فيه كمان رسم ثلاثي، متتاليات، جبر رمزي محدود لمتعددات الحدود، وحساب مالي للتعلم. من FORMAT اختار العشري الدوري. في «شاهين للمذاكرة» اكتب تعبير أو مسألة، واضغط «ابدأ الحل محليًا»، ثم «وريني تلميح» أو «وريني خطوات الحل». لو النص مش مدعوم، تقدر تدخل الصيغة بإيدك أو تطلب تلميح أونلاين. الصيغة المقترحة تتراجع وتتعدل أولًا؛ الحاسبة تتحقق من حسابها، مش من إن تفسير السؤال صحيح. ما تبعتش بيانات شخصية.',
      en: 'Plot Cartesian, polar or parametric curves and move the trace point. Cartesian zero, intersection and integral estimates are approximate. HOME also offers 3D surfaces, sequences, scoped polynomial algebra and educational finance. Use FORMAT for recurring decimals. In Shaheen Study, enter a problem, choose Work it out locally, then reveal a hint or steps. For unsupported text, enter the formula manually or ask for an online hint. Review and edit an AI-suggested formula before calculating it locally; checking its calculation does not confirm its interpretation. Do not send personal data.',
    },
    keywords: ['رسم الدوال', 'الرسم البياني للحاسبة', 'شاهين للمذاكرة', 'ذاكر مع شاهين', 'خطوات الحل', 'جبر رمزي', 'العشري الدوري', 'graph functions', 'calculator graph', 'shaheen study', 'solution steps', 'symbolic algebra', 'recurring decimal'],
    tags: ['مذاكرة', 'حاسبة هندسية', 'رسم الدوال', 'shaheen study', 'graphing'],
  },
  {
    id: 'clock_tools', group: 'help', tab: 'home', docId: 'kb-platform-clock-tools',
    name: { ar: 'المنبّهات وأدوات الساعة', en: 'Alarms and clock tools' },
    summary: { ar: 'بطاقة الساعة في الرئيسية فيها منبّهات بتكرار وغفوة، عداد تنازلي وساعة إيقاف.', en: 'The home clock has alarms with repeat and snooze, a countdown timer, and a stopwatch.' },
    details: {
      ar: 'تحت أرقام الساعة اضغط «المنبّهات» ثم «إضافة منبّه»، واختار الوقت وأيام التكرار. العداد التنازلي فيه مدد سريعة ومدة حسب اختيارك وإيقاف واستكمال، وساعة الإيقاف بتسجّل اللفات. من «الصوت والإشعارات» اختار النغمة وجربها وحدّد مدة الغفوة. الأدوات بتفضل شغالة وإنت بتتنقّل بين صفحات الموقع وبتتحفظ في نفس المتصفح. خلي الموقع مفتوح؛ الرنّة مش مضمونة لو قفلته أو المتصفح وقّف التبويب.',
      en: 'Below the home clock, choose Alarms → Add alarm, enter a time, and choose repeat days. Timer supports presets or a custom duration, pause and resume; Stopwatch records laps. Sound & notifications lets you test a tone and set the snooze length. The tools keep running across site sections and save in this browser. Keep the site open; a closed or suspended tab cannot reliably ring.',
    },
    keywords: ['المنبهات', 'منبه', 'تنبيه الساعة', 'غفوة', 'تايمر', 'العداد التنازلي', 'ساعة الايقاف', 'clock tools', 'alarm', 'snooze', 'countdown timer', 'stopwatch'],
    tags: ['الساعة', 'تايمر', 'منبّه', 'alarms', 'timer', 'stopwatch'],
  },
  {
    id: 'home_headlines', group: 'reference', tab: 'home', docId: 'kb-platform-home-news-desk',
    name: { ar: 'نشرة شام للأخبار المحلية والعالمية', en: 'Sham News Briefing: local and world news' },
    summary: { ar: '«نشرة شام» شريط عناوين بتتقلّب تلقائيًا فوق الساعة في الرئيسية. اضغط «افتح النشرة» عشان تشوف الخبر الرئيسي وأحدث العناوين.', en: 'Sham News Briefing rotates headlines above the Home clock. Select Open briefing to see the lead story and latest headlines.' },
    details: {
      ar: 'بدّل بين «محلي» حسب بلد الدخول و«عالمي». تحت كل عنوان المصدر والتاريخ أو الوقت المتاح، والضغط عليه بيفتح الخبر عند ناشره. استخدم «كل العناوين المتاحة» أو صفّي بالمصدر. فيه زر إيقاف التقليب وزر للعنوان التالي فوق الساعة. لو مفيش أخبار جديدة، بتشوف العناوين الحديثة المتاحة بتواريخها الحقيقية. الصور المتحقق من ترخيصها بتظهر مع اسم صاحبها، والباقي عناوين من غير صور أحداث. «دليل الصحف» شغّال حتى لو العناوين مش متاحة: اختار بلد، قلّب بالأسهم أو اضغط «كل الصحف». الأغلفة توضيحية والضغط عليها بيفتح موقع الناشر. اختيار البلد في الدليل ما بيغيّرش نسخة الأخبار المحلية. مجلة شام للعطور منفصلة.',
      en: 'Switch between Local for the detected entry country and World. Each headline shows its publisher and available date or time, and opens the original article. Choose All available headlines or filter by source. Pause the roll or choose the next headline right above the clock. Recent stories keep their actual dates when there’s no newer headline. Verified photos show their credits; other stories have no event photo. Press directory works even when headlines aren’t available: pick a country, page through with the arrows, or select All outlets. The illustrated covers open the publishers’ sites. Choosing a country there does not switch the local news edition. The perfume Journal is separate.',
    },
    keywords: ['نشرة شام', 'افتح النشرة', 'موجز الاخبار', 'اخبار مصر', 'اخبار العالم', 'الاخبار المحلية', 'الاخبار العالمية', 'كل العناوين المتاحة', 'كل عناوين اليوم', 'تدوير الاخبار', 'منصات اخبار العالم', 'صور الاخبار', 'صحف بلدي', 'الصحف المحلية', 'دليل الصحف', 'عرض الصحف بالصور', 'الصحف العالمية', 'كل الصحف', 'news briefing', 'open briefing', 'local news', 'egypt headlines', 'world headlines', 'home news', 'headline rotation', 'world news platforms', 'news photos', 'local newspapers', 'press directory', 'world press', 'newspaper picture guide'],
    tags: ['الأخبار', 'الصحف بالصور', 'بلد الدخول', 'headlines', 'news briefing'],
  },
  {
    id: 'visitor_compass', group: 'help', tab: 'home', docId: 'kb-platform-qibla-compass',
    name: { ar: 'بوصلة الساعة واتجاه القبلة', en: 'Home compass and Qibla' },
    summary: { ar: 'جنب الساعة في الرئيسية فيه بوصلة مرقّمة، برسمة الكعبة في النص وسهم للقبلة بعد تحديد الموقع أو اختيار مدينة.', en: 'The numbered dial beside the Home clock has a Kaaba drawing at its centre and shows the Qibla arrow after you use your location or choose a city.' },
    details: {
      ar: 'اضغط «حدّد القبلة بموقعي» واسمح بالموقع، أو اضغط «اختار مدينة» للتقدير من مركزها. الزاوية من الشمال الجغرافي. بعد كده اضغط «فعّل البوصلة» واسمح بحساسات الاتجاه لو المتصفح طلب إذن. امسك الموبايل أفقي بعيد عن المعادن، ولفّه لحد ما السهم يقابل العلامة فوق. الكعبة بتتحرّك في وسط القرص مع لفّ الموبايل. البوصلة بتحتاج قراءة شمال من الحساسات؛ الجيروسكوب لوحده مايكفيش. لو مش متاح، الشمال بيبقى فوق في الرسم الثابت والسهم مش دليل على اتجاه الموبايل. لو المعاينة مانعة السماح، افتح الصفحة في تبويب مستقل على الموبايل. حساب القبلة وقراءة الحساس على جهازك، والموقع مش مطلوب للبوصلة العادية. في الصفحات التانية افتح «أدوات الساعة».',
      en: 'Choose Find Qibla using my location, or Choose a city for an estimate from its centre. The angle is clockwise from geographic north. Then select Enable compass and grant sensor access if asked. Hold your phone flat and away from metal; turn it until the arrow meets the top notch. The centred Kaaba drawing moves gently as you turn. Tracking needs a north-referenced sensor reading; a gyroscope alone is not enough. Without it, the diagram stays north-up, not aligned to your phone. If the preview blocks permission, open the page in its own tab on a phone. Qibla calculations and compass readings stay on-device; ordinary heading doesn’t require location. On other pages, open Clock tools.',
    },
    keywords: ['البوصلة', 'بوصلة', 'بوصله', 'بوصلة الساعة', 'القبلة', 'القبله', 'اتجاه القبلة', 'بوصلة القبلة', 'اتجاه الكعبة', 'الجيروسكوب', 'compass', 'compass dial', 'home compass', 'qibla', 'qiblah', 'qibla direction'],
    tags: ['البوصلة', 'القبلة', 'الكعبة', 'الساعة', 'compass', 'heading', 'qibla'],
  },
  {
    id: 'prayer_device_audio', group: 'help', tab: 'home', docId: 'kb-platform-prayer-device-audio',
    name: { ar: 'حفظ تسجيل الأذان من جهازك', en: 'Save a device recording for adhan' },
    summary: { ar: 'احفظ تسجيلًا مستقلًا للفجر وآخر لباقي الصلوات في نفس المتصفح، من غير رفع للموقع أو تفعيل التنبيه.', en: 'Save separate recordings for Fajr and the other prayers in this browser, without uploading them or enabling reminders.' },
    details: {
      ar: 'من «أوقات الصلاة» جنب الساعة افتح «الأذان والتنبيه». اضغط «اختار واحفظ ملف من جهازك» تحت الفجر أو باقي الصلوات، واختار MP3 أو M4A أو AAC أو WAV لحد ١٢ ميجا و٨ دقايق. بعد ظهور اسم التسجيل وعلامة الحفظ تقدر تسمعه أو تستبدله أو تحذفه. التسجيل بيظهر تاني في نفس المتصفح؛ مفيش رفع أو مزامنة مع جهاز تاني. «مسح جميع بياناتي» في الخصوصية بيمسح التسجيلات. لتشغيل التنبيه، أكد المدينة واختر «تنبيه بصوت الأذان» وسيب الصفحة مفتوحة. مجرد حفظ الصوت مش بيشغّل التنبيه.',
      en: 'Open Prayer times by the clock, then Adhan & reminders. Choose and save a file from your device under Fajr or the other prayers. Use MP3, M4A, AAC or WAV up to 12 MB and 8 minutes. Once the filename and saved status appear, you can preview, replace or delete it. The recording is available next time in this browser, without upload or cross-device sync. Wipe All My Data in Privacy removes the recordings. To hear reminders, confirm the city, choose Reminder with adhan and leave the page open. Saving the sound does not turn on reminders.',
    },
    keywords: ['حفظ تسجيل الأذان', 'حفظ صوت الأذان', 'حفظ ملف الأذان', 'أذان من جهازي', 'ملف الأذان من جهازي', 'رفع صوت الأذان', 'حذف تسجيل الأذان', 'save a device recording for adhan', 'save my adhan recording', 'save an adhan recording', 'adhan file', 'custom adhan', 'upload an adhan'],
    tags: ['تسجيل الأذان', 'ملف صوتي محلي', 'prayer tools', 'saved audio'],
  },
  {
    id: 'prayer_listening', group: 'help', tab: 'home', docId: 'kb-platform-prayer-listening',
    name: { ar: 'استرجاع المواقيت ومكتبة الأذان', en: 'Restore prayer times & adhan library' },
    summary: { ar: 'لو أخفيت المواقيت والأذكار، خانة «استرجاع المواقيت والأذكار» بتفضل ظاهرة في الساعة على نفس المتصفح.', en: 'If you hide prayer times and adhkar, the clock keeps a Restore prayer times & adhkar shortcut on the same browser.' },
    details: {
      ar: 'اضغط «استرجاع المواقيت والأذكار» جنب البوصلة في الرئيسية أو مباشرة في شريط الساعة بأي قسم. اختيار المدينة والطريقة والأصوات المحفوظة بيفضل، لكن التنبيه مايرجعش إلا لما تفعّله بنفسك. للاستماع افتح «الأذان والتنبيه» ثم «أذان الحرمين وآيا صوفيا والقرّاء». اختار الحرم المكي (علي ملا)، المسجد النبوي (عصام بخاري)، مسجد آيا صوفيا (أذان إعادة الافتتاح أو الفجر)، أو مشاهير القرّاء زي عبد الباسط والحصري والمنشاوي والعفاسي. التسجيلات دي بتفتح عند الناشر للاستماع، مش أصوات تنبيه. للتنبيه اختار تسجيل مرخّص داخل الموقع أو «اختار واحفظ ملف من جهازك» لو التسجيل عندك.',
      en: 'Choose Restore prayer times & adhkar beside the compass on Home or directly in the compact clock on other pages. Your saved city, calculation and voice choices stay in place; reminders stay off until you turn them back on. In Adhan & reminders, open Adhan from the holy mosques, Hagia Sophia & reciters. There are separate groups for Makkah (including Ali Mulla), Madinah (including Issam Bukhari), Hagia Sophia (reopening and dawn), and reciters such as Abdul Basit, Al-Husary, Al-Minshawi and Alafasy. These are links for listening on the publisher’s site, not reminder options. Use a licensed built-in recording or save a recording from your device for reminders.',
    },
    keywords: ['استرجاع المواقيت', 'استرجاع أوقات الصلاة', 'إظهار أوقات الصلاة', 'اختفت مواقيت الصلاة', 'مواقيت الصلاة مخفية', 'مكتبة الأذان', 'الحرم المكي', 'المسجد النبوي', 'الحرم المدني', 'الأذان المكي', 'الأذان المدني', 'آيا صوفيا', 'مشاهير القراء', 'restore prayer times', 'restore hidden prayer times', 'hidden prayer times', 'adhan library', 'makkah adhan', 'madinah adhan', 'hagia sophia'],
    tags: ['استرجاع', 'الحرمين', 'آيا صوفيا', 'adhan listening', 'prayer tools'],
  },
  {
    id: 'prayer_times', group: 'help', tab: 'home', docId: 'kb-platform-prayer-times',
    name: { ar: 'أوقات الصلاة والأذان والأذكار', en: 'Prayer times, adhan and adhkar' },
    summary: { ar: '«أوقات الصلاة» جنب البوصلة في الرئيسية. فيها جدول تقريبي حسب البلد والمدينة، وتذكير اختياري ومكتبة أذكار.', en: 'Prayer times beside the Home compass offers a city-local estimated schedule, optional reminders and an adhkar library.' },
    details: {
      ar: 'افتح «أوقات الصلاة» جنب البوصلة، أو اضغط وقت الصلاة القادمة في شريط الساعة بالصفحات التانية. في «المكان وطريقة الحساب» اختار البلد والمدينة أو استخدم موقعك بموافقتك، وتقدر تغيّر طريقة الحساب أو حساب العصر. راجع تقويم مسجدك لأن المواعيد تقديرية. في «الأذان والتنبيه» اختار تنبيه صامت أو أذان، وصلوات التذكير وصوت مستقل للفجر. مفيش صوت تلقائي، والتنبيه مقفول لحد ما تفعّله من الصفحة المفتوحة، ومش مضمون وهي مقفولة أو المتصفح موقّفها. فيه تسجيلات مرخّصة وتجربة صوت وحفظ ملف من جهازك في المتصفح من غير رفع، وروابط استماع خارجية لأصوات مشهورة مش ضمن أصوات التنبيه. «الأذكار والأدعية» فيها بحث ومصادر وعدّاد ورابط حصن المسلم كاملًا. لو مش محتاج الأداة اضغط «إخفاء الأداة وإيقاف التنبيهات». لو حبيت ترجعها، اضغط «استرجاع المواقيت والأذكار» في بطاقة الساعة.',
      en: 'Open Prayer times beside the compass, or choose the next-prayer shortcut in the clock on other pages. In Location and calculation, choose your country and city or allow device location, and change the method or Asr convention as needed. Check your mosque’s timetable: these are estimates. In Adhan & reminders, choose silent or audible reminders, prayers, and a separate Fajr voice. There is no autoplay or default reminder, and a closed or suspended page cannot reliably remind you. Preview licensed recordings or save your own file in this browser without uploading. External links to well-known voices are not built-in sounds. Adhkar & duas offers search, references, a repetition counter and a link to the complete Hisn al-Muslim. Hide tool and turn reminders off leaves a Restore prayer times & adhkar shortcut in the clock. Restoring the card does not turn reminders on.',
    },
    keywords: ['اوقات الصلاة', 'مواقيت الصلاة', 'وقت الصلاة', 'تذكير الصلاة', 'تنبيه الصلاة', 'تنبيه الأذان', 'صوت الاذان', 'الاذان', 'اذان الفجر', 'الأذكار', 'اذكار الصباح', 'حصن المسلم', 'prayer times', 'prayer reminder', 'salah times', 'adhan', 'fajr', 'adhkar', 'hisn al-muslim'],
    tags: ['أوقات الصلاة', 'الأذان', 'الأذكار', 'prayer times', 'reminders'],
  },
  {
    id: 'molecule_studio', group: 'lab', tab: 'molecule_studio', docId: 'kb-platform-molecule-studio',
    name: { ar: 'معمل الجزيئات (Molecule Studio)', en: 'Molecule Studio' },
    summary: {
      ar: 'معمل كامل لبناء التركيبة من قاعدة مواد خام معروفة، وتحليل قائمة مكونات، وتخطيط التحضير والتعتيق.',
      en: 'A complete studio to compose from a known raw-material database, analyse an ingredient list, and plan preparation and maceration.',
    },
    details: {
      ar: 'أربع شاشات: «التركيب» تضيف المواد بنسبها لكل نوتة، و«تحليل قائمة» تلصق فيها مكونات تركيبة فتتحقق من الأسماء والنسب، و«التحضير والتعتيق» ترتّب خطوات الوزن والتعتيق، و«مكتبة مرجعية» للمواد بأرقام CAS. النسب تعليمية وليست وصفة تجارية جاهزة، وتقدر تنقل النتيجة للحاسبات.',
      en: 'Four screens: Compose adds materials with their share of each note; Analyze list checks the names and percentages of a pasted formula; Preparation & aging orders the weighing and maceration steps; and a reference library lists materials with CAS numbers. Percentages are educational, not a commercial recipe, and results carry over to the calculators.',
    },
    keywords: ['معمل الجزيئات', 'استوديو الجزيئات', 'المعمل الجزيئي', 'تحليل قائمة', 'تحليل مكونات', 'molecule studio', 'analyze ingredients'],
    tags: ['molecule studio', 'معمل', 'تحليل', 'تركيب'],
  },
  {
    id: 'designers', group: 'lab', tab: 'perfume_designers', docId: 'kb-platform-designers',
    name: { ar: 'قسم المصممين (عطور وتجميل)', en: 'Designers’ section (perfume and cosmetics)' },
    summary: {
      ar: 'دفتر تفاعلي للمصمم: يكتب تركيبته (عطر أو مستحضر تجميل) فيعمل لها محاكاة كاملة — النتيجة والتشابه والتوافق مع المعايير الدولية وسبب أي رفض — ومعاها معمل وأدوات تخليق.',
      en: 'An interactive journal for designers: write a perfume or cosmetic formula and get a full simulation — the result, what it resembles, and whether it meets international standards and why — with a lab and creative tools.',
    },
    details: {
      ar: 'في العطور: الطابع والهرم وتطور الريحة ساعة بساعة والثبات والفوحان، وتشابه مع عطور مكتبة العالم والمتجر، وفحص حدود IFRA (الفئة 4) والحمضيات الحساسة للشمس والمواد الممنوعة ومسببات الحساسية اللي لازم تتكتب. في التجميل: نوع المنتج وقوامه والحموضة والحافظة والمستحلب وحدود لائحة الاتحاد الأوروبي. الأدوات: وازن الهرم، صلّح التوافق، زوّد الثبات، كمّل بالماء، إلهام، ونقطة بداية. ورقة تشغيلة بالمل والجرام والنقط، ودفتر نسخ وتقييمات محفوظ على جهاز المصمم. المحاكاة تقريبية ومش شهادة.',
      en: 'Perfume: character, pyramid, the scent hour by hour, staying power and projection, resemblance to the world library and store perfumes, and checks for IFRA Category 4 limits, sun-sensitising citrus, prohibited materials and allergens to label. Cosmetics: product type, texture, pH, preservative, emulsifier and EU limits. Tools: balance the pyramid, fix compliance, boost staying power, top up with water, inspire, starting points. A batch sheet in ml, grams and drops, and a journal of versions and ratings kept on the designer’s device. The simulation is approximate, not a certificate.',
    },
    keywords: ['قسم المصممين', 'دفتر المصمم', 'محاكاة التركيبة', 'محاكاة تركيبة', 'designers section', 'formula simulation', 'perfume simulation'],
    tags: ['مصممين', 'محاكاة', 'designers', 'simulation'],
  },
  {
    id: 'maceration', group: 'lab', tab: 'maceration_simulator', docId: 'kb-maceration',
    name: { ar: 'محاكي التعتيق ودليل المثبتات', en: 'Maceration simulator & fixatives guide' },
    summary: {
      ar: 'يوضّح مدة التعتيق المناسبة لنوع التركيبة ودور المثبتات، مع محاكي زمني للتعتيق.',
      en: 'Shows a suitable maceration period for each formula type and what fixatives do, with a time simulator.',
    },
    details: {
      ar: 'اختار نوع العطر (حمضي، زهري، شرقي، عود…) وبيظهر مدى التعتيق النموذجي وشرح المثبتات، وفي «دليل التعتيق» تفاصيل النضوج والمذيبات. المدد إرشادية وبتتأثر بالمواد والتركيز والحرارة.',
      en: 'Pick the scent family (citrus, floral, oriental, oud…) to see a typical maceration range and a fixative explanation; the aging guide covers maturation and solvents in depth. Ranges are guidance and depend on materials, concentration and temperature.',
    },
    keywords: ['محاكي التعتيق', 'مدة التعتيق', 'المثبتات', 'ماسيراشن', 'maceration simulator', 'fixatives', 'maceration'],
    tags: ['تعتيق', 'مثبتات', 'maceration', 'fixative'],
  },
  {
    id: 'raw_materials', group: 'reference', tab: 'raw_materials', docId: 'kb-platform-raw-materials',
    name: { ar: 'موسوعة المواد الخام', en: 'Raw materials encyclopedia' },
    summary: {
      ar: 'فهرس مواد عطرية مشروحة بعائلاتها وأرقام CAS وقواعد الأمان وملاحظات الاستخدام.',
      en: 'An index of perfumery materials with families, CAS numbers, safety notes and usage guidance.',
    },
    details: {
      ar: 'فيها بحث وتصنيفات (زيوت طبيعية، مذيبات، مثبتات، جزيئات حديثة، صموغ وأدهان عود)، وتقدر تضيف أي مادة كنوتة في الهرم مباشرة. المعلومات تعليمية، والسلامة النهائية بتتحدد بشهادة المورد وتركيز الاستخدام.',
      en: 'It has search and categories (natural oils, solvents, fixatives, modern molecules, gums and oud oils), and any material can be added straight to the pyramid as a note. The content is educational; final safety follows the supplier certificate and use concentration.',
    },
    keywords: ['موسوعة المواد الخام', 'المواد الخام', 'مواد عطرية', 'raw materials', 'raw material encyclopedia', 'cas'],
    tags: ['مواد خام', 'موسوعة', 'raw materials', 'cas'],
  },
  {
    id: 'world_perfumes', group: 'reference', tab: 'world_perfumes', docId: 'kb-platform-world-perfumes',
    name: { ar: 'مكتبة العطور العالمية', en: 'World perfumes library' },
    summary: {
      ar: 'نماذج أكورد تعليمية مستوحاة من عطور عالمية مشهورة، بنسب توضيحية لا تمثل التركيبات الأصلية.',
      en: 'Educational accord studies inspired by famous perfumes, with illustrative percentages — not the makers’ original formulas.',
    },
    details: {
      ar: 'تفتح العطر وتشوف نوتاته ونسبه التوضيحية، وتقدر تحمّله على حاسبة المعمل أو تطبع بطاقة التركيبة. المكتبة تعليمية وليست تحليلاً مخبرياً ولا تفصح عن وصفة أي دار عطور.',
      en: 'Open a perfume to see its notes and illustrative shares, then load it into the lab calculator or print a formula card. The library is educational — not a laboratory analysis, and it never reveals any perfume house’s recipe.',
    },
    keywords: ['مكتبة العطور العالمية', 'عطور عالمية', 'أكورد', 'world perfumes', 'perfume library'],
    tags: ['عطور عالمية', 'أكورد', 'reference', 'world perfumes'],
  },
  {
    id: 'books', group: 'reference', tab: 'world_perfumes', docId: 'kb-platform-books',
    name: { ar: 'مكتبة الكتب والكتيّبات', en: 'Book library & booklets' },
    summary: {
      ar: 'مكتبة كتب عطور إلكترونية: كتيّبات أصلية كاملة تُقرأ في المتصفح، وفهرس لمراجع عالمية بدون ملفات كتب.',
      en: 'An e-book library: original booklets readable in the browser, plus a catalogue of world references without book files.',
    },
    details: {
      ar: 'الكتيّبات الأصلية (دليل القراءة، دفتر الأدلة، دليل التذوق، كتاب اللمعان) متاحة كاملة بصيغة EPUB بقارئ داخل الموقع، أما المراجع الستة عشر فهي فهرسة فقط لتوثيق بياناتها ولا نرفق نصوصها. التصميم بيتبع لغة الموقع.',
      en: 'The original booklets (reading guide, evidence notebook, scent observation, brilliance) are available in full as EPUB with an in-site reader; the sixteen references are catalogue entries for documentation only and their texts are not attached. The interface follows the site language.',
    },
    keywords: ['مكتبة الكتب', 'كتب العطور', 'كتب', 'كتاب', 'كتيّبات', 'كتاب إلكتروني', 'epub', 'book library', 'books about perfume'],
    tags: ['كتب', 'مكتبة', 'epub', 'books', 'reading'],
  },
  {
    id: 'islamic_library', group: 'reference', tab: 'islamic_library', docId: 'kb-platform-islamic-library',
    name: { ar: 'مكتبة شام الإسلامية', en: 'Sham Islamic Library' },
    summary: { ar: 'أرفف لكتب إسلامية مختارة، وبحث بالعنوان والمؤلف، ومصحف كامل للقراءة داخل المكتبة.', en: 'Shelves of selected Islamic books, search by title or author, and a full in-site Quran reader.' },
    details: {
      ar: 'افتح مكتبة شام الإسلامية من أيقونة الكتاب جنب الأذان والأذكار في الساعة، أو من الرئيسية أو قائمة استكشف. اختَر الرف أو ابحث، واضغط على غلاف الكتاب. «افتح المصحف» يفتح نص تنزيل بالرسم العثماني، وتقدر تختار السورة والآية وتحتفظ بعلامة على جهازك. الكتب المكتوب عليها «عند المصدر» تفتح بطاقتها ثم رابط القراءة في تبويب جديد، بدون استضافة طبعاتها. «فهارس أوسع» تكمّل المجموعة المختارة، ومفيش ادعاء إن الأرفف تضم كل الكتب.',
      en: 'Open Sham Islamic Library using the book icon next to Adhan & adhkar in the clock, or from Home or Explore. Choose a shelf or search, then open a cover. Open the Quran for the Tanzil Uthmani text, surah and verse navigation, and a device-local bookmark. At source books open a card and then the reading link in a new tab; their editions are not hosted here. Wider catalogues supplement the selection without claiming exhaustive coverage.',
    },
    keywords: ['مكتبة شام الإسلامية', 'مكتبة إسلامية', 'المكتبة الإسلامية', 'أرفف الكتب الإسلامية', 'الكتب الإسلامية', 'افتح المصحف', 'فتح المصحف', 'قارئ المصحف', 'islamic library', 'islamic book shelves', 'quran reader', 'open the quran'],
    tags: ['كتب إسلامية', 'مصحف', 'قراءة', 'Islamic library', 'Quran'],
  },
  {
    id: 'news', group: 'reference', tab: 'perfume_news', docId: 'kb-platform-news',
    name: { ar: 'أخبار العطور', en: 'Perfume news' },
    summary: {
      ar: 'نشرة أخبار وصيحات من عالم العطور بيجمعها «الخبير شاهين» من مصادر عامة مع ذكر المصدر.',
      en: 'A perfume news and trends digest gathered by the Sham expert from public sources, with sources credited.',
    },
    details: {
      ar: 'واجهة مجلة شام بتعرض الخبر الرئيسي وآخر العناوين بروابط لمصادرها. اختَر «آخر العناوين» للبحث في المصادر أو صفّي تقارير شام حسب الموضوع واحفظها على جهازك. افتح تقريرًا لنقل مكوّن للهرم العطري أو تجربة الأكورد في حاسبة التركيز. التقارير التحريرية للتعلّم، وهي منفصلة عن الأخبار المنشورة عند المصادر.',
      en: 'The Sham Journal has a lead story and recent headlines linked to their publishers. Choose Latest headlines to search sources, or filter the Sham reports by topic and bookmark them on your device. Open a report to add an ingredient to the fragrance pyramid or try the accord in the concentration calculator. Editorial learning reports are separate from publisher headlines.',
    },
    // No routing keywords on purpose: «إيه آخر أخبار العطور؟» asks for the news itself, so it must keep
    // going to retrieval (the live digest) instead of being answered with “this is the news page”.
    // The feature still appears in the platform map, its suggestions and its knowledge document.
    keywords: [],
    tags: ['أخبار', 'news', 'trends'],
  },
  {
    id: 'shaheen', group: 'workspace', tab: 'master_ai', docId: 'kb-platform-shaheen',
    name: { ar: 'الخبير شاهين', en: 'Master Shaheen' },
    summary: {
      ar: 'خبير المنصة في تصميم العطور: يساعد في اختيار النوتات والعائلات والثبات والتعتيق خطوة بخطوة.',
      en: 'The platform’s perfumery expert: helps with notes, families, longevity and maceration step by step.',
    },
    details: {
      ar: 'موجود في تبويب «الخبير شاهين»، ويقدر يستلم التركيبة اللي بتبنيها ويحوّلها لحاسبة التركيز أو الهرم أو التكاليف، ويسجلها في دفتر الوصفات ويطبع بطاقة تصنيع. للأسئلة عن الطلبات والمتجر والدعم استخدم «مساعد شام» (أنا).',
      en: 'It lives in the Shaheen tab and can take the formula you are building into the concentration, pyramid or costing calculator, record it in the formula library and print a batch sheet. For orders, store and support questions use the Sham assistant (me).',
    },
    keywords: ['الخبير شاهين', 'شاهين', 'master shaheen', 'shaheen', 'معمل الذكاء', 'الذكاء الاصطناعي للعطور'],
    tags: ['شاهين', 'خبير', 'shaheen', 'formulation'],
  },
  {
    id: 'shaheen_tools', group: 'workspace', tab: 'master_ai', docId: 'kb-platform-shaheen-tools',
    name: { ar: 'وضع أدوات شاهين', en: 'Shaheen tool mode' },
    summary: { ar: 'وضع اختياري لحسابات بأدوات فعلية وقراءة ملفات نصية وتجهيز تقارير للتنزيل.', en: 'Opt-in tool execution for calculations, text attachments and downloadable reports.' },
    details: {
      ar: 'افتح أدوات شاهين في الشات أو المعمل وفعّل وضع الوكيل، واختر تلقائي أو سريع أو معمق. يدعم الحسابات والدفعات والتخفيف والتكلفة والمواد ومراجعة التركيبات وقراءة حتى 3 ملفات نصية بإجمالي 12000 حرف، وتجهيز ملفين للتنزيل بنقرة. لا يكتب في حسابات أو مستودعات ولا ينفذ كوداً. تحتاج دورة الوكيل خدمة ذكاء متاحة، والبحث الخارجي اختياري بإعداد الإدارة وموافقتك؛ لا يتجاوز الحصة. المرفقات قد تصل للمزود ومقتطفاتها في الردود تُحفظ مع المحادثة؛ لا ترفع أسراراً.',
      en: 'Open Shahin tools in chat or the lab, enable agent mode and choose auto, fast or deep. Supports calculations, batches, dilution, costing, materials, formula checks, up to 3 text files totaling 12000 characters and two click-to-download reports. No code execution, account access or repository changes. Requires an available AI service; optional external search needs admin configuration and your consent. It does not bypass quota. Attachments may reach the provider and excerpts in replies may be saved in chat; never upload secrets.',
    },
    keywords: ['أدوات شاهين', 'وضع الوكيل', 'إرفاق ملف نصي', 'تقرير للتنزيل', 'shahin tools', 'shaheen tool mode', 'agent mode', 'text attachments', 'download report'],
    tags: ['أدوات', 'وكيل', 'مرفقات', 'tools', 'agent'],
  },
  {
    id: 'shaheen_voice', group: 'workspace', tab: 'master_ai', docId: 'kb-platform-shaheen-voice',
    name: { ar: 'وضع التحدث مع شاهين', en: 'Shaheen voice chat' },
    summary: {
      ar: 'تكلّم مع شاهين بدل الكتابة: المتصفح يفرّغ كلامك لنص، وشاهين يرد بصوت عبر المحادثة نفسها.',
      en: 'Talk to Shaheen instead of typing: your browser transcribes your speech, and Shaheen replies aloud through the same chat.',
    },
    details: {
      ar: 'من صفحة «الخبير شاهين» أو نافذة شاته اضغط «صوت»، اقرأ الإفصاح واسمح للمتصفح باستخدام الميكروفون. المتصفح يفرّغ كلامك لنص ويرسله لمحادثة شاهين المعتادة؛ الرد يفضل مكتوباً ويتقال بصوت شاهين البشري من خدمة شام، مع إمكانية المقاطعة والكتم. قد يعالج المتصفح أو خدمة التعرف على الكلام الصوت أو النص حسب إعداداتها؛ شام لا يسجل أو يرفع ملف الصوت. الميزة تحتاج متصفحاً يدعم التعرف على الكلام، وإذن الميكروفون واتصالاً آمناً وخدمة الصوت البشرية متاحة؛ لو الصوت تعذّر يفضل الرد مكتوباً وتقدر تستخدم الكتابة أو زر قراءة الرد.',
      en: 'On the Shaheen expert page or in his chat, press “Voice”, review the disclosure and allow browser microphone access. Your browser transcribes speech and sends it through Shaheen’s regular conversation; the reply remains written and is spoken in Shaheen’s human voice by Sham’s voice service, with interrupt and mute controls. Your browser or speech-recognition service may process audio or text under its own settings; Sham does not record or upload your audio file. This needs speech recognition, microphone permission, a secure connection and the human-voice service to be available; if audio fails, the written reply remains and you can type or use read-aloud.',
    },
    keywords: ['وضع التحدث مع شاهين', 'المحادثة الصوتية', 'أتكلم مع شاهين', 'كلم شاهين', 'صوت شاهين', 'voice chat', 'voice mode', 'talk to shaheen', 'speak to shaheen', 'speech with shaheen'],
    tags: ['تحدث', 'صوت', 'ميكروفون', 'voice chat', 'speech', 'Shaheen'],
  },
  {
    id: 'assistant_voice', group: 'help', tab: 'home', docId: 'kb-platform-assistant-voice',
    name: { ar: 'التحدث مع مساعد شام بالصوت', en: 'Voice chat with Sham assistant' },
    summary: {
      ar: 'في الشات العام تقدر تتكلم مع مساعد شام من غير كتابة، تسمع رده بصوت بشري، وتقاطعه أو تكتم الميكروفون.',
      en: 'In the public chat, speak instead of typing, hear a human-voiced reply, interrupt it or mute the microphone.',
    },
    details: {
      ar: 'افتح فقاعة «مساعد شام للخدمات» واضغط زر «صوت»، واقرأ إفصاح الميكروفون قبل الموافقة. يتعرّف المتصفح على كلامك ويرسله كنص إلى نفس محادثة مساعد شام؛ صوت الرد يُجهّز من خدمة شام البشرية، ويظهر الرد مكتوباً أيضاً. تقدر تقاطع شاهين وهو بيتكلم أو تكتم/توقف الميكروفون. شام لا يسجل ولا يرفع ملف صوتك؛ قد يعالج المتصفح أو خدمة التعرف على الكلام الصوت أو النص حسب إعداداتها. تحتاج متصفحاً يدعم التعرف على الكلام واتصالاً آمناً وخدمة الصوت البشرية متاحة؛ لو الصوت غير متاح يظل الرد مكتوباً، وتقدر تستخدم الكتابة أو قراءة الرد. إجابات الصوت تتبع نفس بيانات المتجر وسياسات السلامة، وتكون أقصر لتتقال بطبيعية.',
      en: 'Open the “Sham services assistant” bubble and press “Voice”; review the microphone disclosure before agreeing. Your browser recognizes speech and sends its transcript into the same Sham assistant conversation. Sham’s human-voice service prepares spoken replies, which also remain visible as text. You can interrupt Shaheen while he speaks, mute or stop the microphone. Sham does not record or upload your audio file; your browser or speech-recognition service may process audio or text under its own settings. This needs speech recognition, a secure connection and an available human-voice service. If audio is unavailable, the written reply remains; you can type or use read-aloud. Voice answers follow the same store grounding and safety rules, phrased more briefly for speech.',
    },
    keywords: ['مساعد شام بالصوت', 'الشات العام بالصوت', 'شات الخدمات بالصوت', 'صوت مساعد شام', 'أتكلم مع مساعد شام', 'public chat voice', 'voice chat with sham assistant', 'voice chat with sham', 'services assistant voice'],
    tags: ['صوت', 'شات عام', 'ميكروفون', 'human voice', 'public chat'],
  },
  {
    id: 'library', group: 'workspace', tab: 'library', docId: 'kb-platform-formulas',
    name: { ar: 'دفتر الوصفات وبطاقة التصنيع', en: 'Formula library & batch sheet' },
    summary: {
      ar: 'مكان تحفظ فيه تركيباتك، ترجّعها للحاسبة، تطبع بطاقة تصنيع، وتشاركها برابط أو واتساب.',
      en: 'Where you keep your formulas, load them back into the calculator, print a batch sheet and share a link or WhatsApp.',
    },
    details: {
      ar: 'الحفظ من زر الحفظ في حاسبة التركيز أو من الخبير شاهين، والتركيبات بتتحفظ في متصفحك على نفس الجهاز ومش بتروح لسيرفر شام، فلو مسحت بيانات المتصفح بتتمسح. بطاقة التصنيع فيها المكونات والأوزان وخطوات التحضير بدون أي هامش أو تكلفة داخلية.',
      en: 'Save from the concentration calculator or from Master Shaheen. Formulas are stored in your browser on this device and are not sent to Sham’s server, so clearing browser data removes them. The batch sheet lists ingredients, weights and preparation steps with no margin or internal cost.',
    },
    keywords: ['دفتر الوصفات', 'مكتبة الوصفات', 'بطاقة التصنيع', 'تركيباتي', 'formula library', 'batch sheet', 'save formula'],
    tags: ['وصفات', 'تركيبات', 'حفظ', 'formula', 'batch sheet'],
  },
  {
    id: 'community', group: 'community', tab: 'community', docId: 'kb-platform-community',
    name: { ar: 'مجتمع شام', en: 'Sham Community' },
    summary: {
      ar: 'شبكة اجتماعية لصنّاع العطور: منشورات وأصدقاء ونقاش وماسنجر وبريد داخلي وبوابة تجار.',
      en: 'A social network for perfumers: posts, friends, discussions, messenger, internal mail and a merchant portal.',
    },
    details: {
      ar: 'داخل «مجتمع شام»: السوشيال والستوريز والمنشورات، مجلس النقاش، أخبار العطور، الأصدقاء، الإشعارات، الماسنجر، «بريد شام» الداخلي (وارد ومميّز ومرسل ومسودات وأرشيف ومهملات)، و«بوابتي» فيها ملفك وتركيباتك المحفوظة وتعلّمك ومشترياتك وإعدادات الأمان. كل ده بيفتح من تبويب المجتمع، ومحتاج حساب عضو، ولو قاعدة البيانات مش متاحة ببيقول «لسه بيتجهّز» بصراحة.',
      en: 'Inside Sham Community: the social feed, stories and posts, discussions, perfume news, friends, notifications, messenger, internal Sham mail (inbox, starred, sent, drafts, archive, trash) and “My portal” with your profile, saved recipes, learning progress, purchases and security settings. It all opens from the Community tab, needs a member account, and says honestly that it is being prepared when the database is unavailable.',
    },
    keywords: ['مجتمع شام', 'المجتمع', 'سوشيال شام', 'ناسنجر', 'ماسنجر', 'بريد شام', 'بوابة التجار', 'sham community', 'community', 'messenger'],
    tags: ['مجتمع', 'سوشيال', 'ماسنجر', 'community', 'social'],
  },
  {
    id: 'merchant', group: 'community', tab: 'community/merchant', docId: 'kb-platform-merchant',
    name: { ar: 'بوابة التجار ومتجرك في شام', en: 'Merchant portal & your store' },
    summary: {
      ar: 'تفتح متجرك جوه شام: تضيف منتجاتك بسعرك، والإدارة بتراجع وتنشر، وشام بتتولى الدفع والشحن.',
      en: 'Open your store inside Sham: add products at your price, the team reviews and publishes, and Sham handles payment and shipping.',
    },
    details: {
      ar: '«بوابة التجار» فيها لوحة المتجر وأرقام المنتجات والطلبات ومستحقاتك، و«منتجاتي» لإضافة منتج بسعرك وعملتك، و«بيانات المتجر» للشعار والوصف. المنتج بيستنى اعتماد الإدارة قبل النشر، وروابط وأرقام المورّد بتتشال من النص العام. سوق التجار بيعرض متاجر شام للزوار، والزائر بيشتري من صفحة المتجر بالدفع المعتمد.',
      en: 'The merchant portal has the store dashboard with product, order and earnings figures, “My products” to add an item at your own price and currency, and the store file with your logo and description. Each product waits for team approval before publishing, and supplier links or phone numbers are stripped from public text. The merchants’ market lists Sham stores for visitors, who buy from the store page with the approved payment.',
    },
    keywords: ['بوابة التجار', 'بوابة التاجر', 'أفتح متجر', 'افتح متجر', 'أبيع منتجاتي', 'بيع منتجاتي', 'merchant portal', 'sell on sham'],
    tags: ['تاجر', 'متجر', 'merchant', 'seller'],
  },
  {
    id: 'account', group: 'community', tab: 'community/me', docId: 'kb-platform-account',
    name: { ar: 'حسابك وتسجيل الدخول', en: 'Your account & sign-in' },
    summary: {
      ar: 'حساب ببريد وكلمة مرور، مع تأكيد البريد، استعادة كلمة المرور، تحقق بخطوتين ومفتاح مرور بالبصمة.',
      en: 'An account with e-mail and password, e-mail confirmation, password reset, two-step verification and a passkey.',
    },
    details: {
      ar: 'تقدر تدخل بالبريد أو باسم المستخدم، وفيه «نسيت كلمة المرور» بكود على البريد، وقفل مؤقت بعد محاولات غلط، وتحقق بخطوتين (TOTP)، ومفتاح مرور بالبصمة أو الوجه، وإدارة الأجهزة وتنبيه عند أي دخول جديد. متستخدمش كلمة مرور بتاعتك من موقع تاني، ومتكتبش كلمة المرور هنا في المحادثة أبداً.',
      en: 'Sign in with e-mail or username; there is a password reset by e-mail code, a temporary lock after failed attempts, two-step verification (TOTP), a passkey with fingerprint or face, device management and a new-sign-in alert. Never reuse a password from another site and never type your password in this chat.',
    },
    keywords: ['حسابي', 'تسجيل الدخول', 'مفتاح المرور', 'مفتاح مرور', 'التحقق بخطوتين', 'passkey', 'sign in', 'my account', 'password reset'],
    tags: ['حساب', 'دخول', 'password', 'passkey', 'account'],
  },
  {
    id: 'store', group: 'shop', tab: 'store', docId: 'kb-platform-store',
    name: { ar: 'المتجر', en: 'The store' },
    summary: {
      ar: 'عطور جاهزة وزيوت ومواد خام وعبوات بأسعار ومخزون حقيقيين، بسلة وشراء مباشر وتتبّع طلب.',
      en: 'Ready perfumes, oils, raw materials and bottles with real prices and stock, plus a cart, direct purchase and order tracking.',
    },
    details: {
      ar: 'افتح تبويب المتجر وابحث بالفئة أو الاسم. فيه سلة، وزر «شراء مباشر» لمنتج واحد من غير ما تغيّر السلة، وصفحة منتج بتفاصيله وتقييماته. وجوّه المتجر «اسأل شاهين»: تحكي له اللي بتدور عليه وهو يرشّح لك من المنتجات الحقيقية بسبب لكل اختيار. السعر النهائي بيظهر في صفحة إتمام الطلب، والتتبع برقم الطلب مع الهاتف أو البريد المستخدم في الطلب.',
      en: 'Open the store tab and search by category or name. There is a cart, a “buy now” button for one product without touching the cart, and a product page with details and reviews. Inside the store, “Ask Shaheen” lets you describe what you are after and ranks real products with a reason for each pick. The final price appears at checkout, and tracking needs the reference plus the phone or e-mail used in the order.',
    },
    keywords: ['المتجر', 'المتجر الإلكتروني', 'شراء عطر', 'سلة المشتريات', 'رشحلي', 'رشح لي', 'اقترحلي', 'اقترح لي', 'ترشيح عطر', 'store', 'shopping cart', 'buy perfume', 'recommend a perfume'],
    tags: ['متجر', 'شراء', 'store', 'cart'],
  },
  {
    id: 'shipping', group: 'shop', tab: 'store', docId: 'kb-platform-shipping',
    name: { ar: 'الشحن والتوصيل', en: 'Shipping & delivery' },
    summary: {
      ar: 'الشحن بيتحسب حسب منطقة بلدك وعدد الزجاجات، والمدة التقديرية بتظهر مع الشحن في صفحة الطلب.',
      en: 'Shipping depends on your country’s zone and the number of bottles; the estimated time appears with it at checkout.',
    },
    details: {
      ar: 'العطور سائل قابل للاشتعال (UN1266 — Class 3)، فالشحن الجوي محدود وبعض الدول بتمنع أو تقيّد استيراد العطور الكحولية أو مواد معينة مثل خشب العود. الرسوم الجمركية والضرائب في بلدك مسؤولية المستلم وبتظهر بوضوح في صفحة الدفع.',
      en: 'Perfume is a flammable liquid (UN1266 — Class 3), so air shipping is limited and some countries restrict alcohol perfumes or specific materials such as agarwood. Customs duties and local taxes are the recipient’s responsibility and are shown clearly at checkout.',
    },
    keywords: ['الشحن', 'التوصيل', 'مصاريف الشحن', 'مدة الشحن', 'shipping', 'delivery', 'customs'],
    tags: ['شحن', 'توصيل', 'shipping', 'delivery'],
  },
  {
    id: 'privacy', group: 'help', docId: 'kb-privacy',
    name: { ar: 'خصوصيتك وبياناتك', en: 'Your privacy & data' },
    summary: {
      ar: 'المحادثات بتتحفظ على سيرفر شام لمتابعة الطلبات، وتقدر تعرف اللي محفوظ عنك أو تمسحه في أي وقت.',
      en: 'Conversations are kept on Sham’s server to follow up requests; you can see what is stored about you or erase it at any time.',
    },
    details: {
      ar: 'زر «ماذا تعرف عني؟» بيوريك اللي المساعد فاكره، وزر «امسح بياناتي» بيمسح المحادثات والذاكرة نهائياً (الطلبات المسجلة بأرقام SH بتفضل للمحاسبة والمتابعة). متكتبش أرقام بطاقات أو كلمات مرور في المحادثة، وفيه بانر كوكيز وتحكم كامل في المركز القانوني.',
      en: '“What do you know about me?” shows what the assistant remembers, and “erase my data” deletes conversations and memory permanently (submitted SH requests stay for accounting and follow-up). Never type card numbers or passwords in chat; a cookie banner and full controls live in the legal centre.',
    },
    keywords: ['الخصوصية', 'بياناتي', 'حذف بياناتي', 'الكوكيز', 'privacy', 'my data', 'cookies', 'gdpr'],
    tags: ['خصوصية', 'بيانات', 'privacy', 'cookies', 'gdpr'],
  },
  {
    id: 'visitor_suggestions', group: 'help', docId: 'kb-platform-suggestions',
    name: { ar: 'اقتراحات الزوار', en: 'Visitor suggestions' },
    summary: {
      ar: 'تقدر تبعت اقتراحًا اختياريًا من غير حساب، من زر «شارك اقتراحك» في تذييل الموقع.',
      en: 'You can send an optional suggestion without an account using “Share a suggestion” in the site footer.',
    },
    details: {
      ar: 'اكتب اقتراحك ووافق على الإرسال بنفسك. مفيش خانة اسم أو تواصل أو ربط بحسابك؛ البريد والأرقام الطويلة بتتخفى، والأسرار والبيانات الشخصية الواضحة بترفض. إدارة شام تراجع الرسائل وتضع لها موضوعات بالكلمات المفتاحية فقط؛ مش بنحلل المشاعر ولا نبعت النص لمحرك ذكاء ولا نغير ترشيحات أو أسعار أو عروض تلقائيًا. تنتهي صلاحيته بعد 180 يومًا، ويحذفه التنظيف الدوري أو أول استخدام لاحق للموقع؛ وتفاصيل أكتر في سياسة الخصوصية.',
      en: 'Write a suggestion and confirm submission. There is no name or contact field and it is not linked to your account; e-mails and long numbers are redacted, and secrets or clear personal details are refused. Sham administration reviews suggestions and applies keyword-only topic tags; we do not infer emotions, send the text to an AI engine, or automatically change recommendations, prices or offers. Suggestions expire after 180 days and are removed by routine cleanup or on the first later use of the site. See the privacy policy for details.',
    },
    keywords: ['اقتراحات الزوار', 'اقتراح للموقع', 'اقتراح للمنصة', 'اقتراحات الموقع', 'ارسل اقتراح', 'ابعت اقتراح', 'ابعت ملاحظة', 'شارك اقتراحك', 'ملاحظات الموقع', 'send feedback', 'send a suggestion', 'feedback', 'suggestion', 'share feedback'],
    tags: ['اقتراحات', 'ملاحظات', 'خصوصية', 'feedback', 'suggestions'],
  },
  {
    id: 'legal', group: 'help', docId: 'kb-platform-legal',
    name: { ar: 'المركز القانوني', en: 'Legal centre' },
    summary: {
      ar: 'الشروط والأحكام وسياسة الخصوصية والإرجاع والشحن والكوكيز وإفصاح الذكاء الاصطناعي في مكان واحد.',
      en: 'Terms, privacy policy, returns, shipping, cookies and the AI disclosure all in one place.',
    },
    details: {
      ar: 'افتح «المركز القانوني» من تذييل الموقع: نظرة عامة، شروط، خصوصية، إرجاع واسترداد، شحن ومواد خطرة، كوكيز، إفصاح الذكاء الاصطناعي، وتواصل قانوني. صفحة الإرجاع بتشرح شروط الاستبدال والاسترداد للمنتجات، والتواصل القانوني بيبعت لبريد المنصة الرسمي.',
      en: 'Open the Legal Centre from the site footer: overview, terms, privacy, returns & refunds, shipping & dangerous goods, cookies, AI disclosure and legal contact. The returns page explains replacement and refund conditions, and legal contact goes to the platform’s official inbox.',
    },
    keywords: ['الشروط والأحكام', 'المركز القانوني', 'سياسة الخصوصية', 'الإرجاع والاسترداد', 'terms and conditions', 'legal centre', 'refund policy'],
    tags: ['شروط', 'قانوني', 'legal', 'terms', 'refund'],
  },
  {
    id: 'guide', group: 'help', tab: 'guide', docId: 'kb-platform-guide',
    name: { ar: 'دليل المنصة', en: 'Platform guide' },
    summary: {
      ar: 'دليل المنصة بيجمع كل أدوات وميزات شام في مكان واحد، بمكان كل واحدة وطريقة استخدامها.',
      en: 'The platform guide collects every Sham tool and feature in one place, where each one lives and how to use it.',
    },
    details: {
      ar: 'افتح تبويب «الدليل» تشوف الأقسام: أدوات المعمل والحاسبات، المكتبات والمراجع، دفتر الوصفات والخبير شاهين، المجتمع والحساب، والمتجر والشحن — وكل قسم بيوديك على تبويبه. أي أداة جديدة بتظهر هنا مع أول إصدار لها، فالدليل هو المرجع اللي تقدر تعتمد عليه.',
      en: 'Open the Guide tab to see the sections: lab tools and calculators, libraries and references, formulas and Shaheen, community and account, store and shipping — each links to its tab. Every new tool appears here in the release that ships it, so this is the reference you can rely on.',
    },
    keywords: ['دليل الموقع', 'شرح الموقع', 'قائمة الادوات', 'site guide', 'tools list'],
    tags: ['دليل', 'خريطة المنصة', 'guide', 'site map'],
  },
  {
    id: 'languages', group: 'help', docId: 'kb-platform-languages',
    name: { ar: 'اللغات', en: 'Languages' },
    summary: {
      ar: `المنصة متاحة بـ${SUPPORTED_LANGUAGES.length} لغة، ولغة الموقع هي اللي بتحدد لغة النصوص والأرقام.`,
      en: `The platform is available in ${SUPPORTED_LANGUAGES.length} languages, and the site language sets the text and the digits you see.`,
    },
    details: {
      ar: 'غيّر اللغة من زر اللغة في الهيدر أو من إعدادات البلد واللغة؛ الاتجاه بيتقلب تلقائياً للغات اللي من اليمين للشمال، والأرقام بتتكتب بأرقام لغتك. المساعد بيرد بلغة رسالتك.',
      en: 'Change the language from the header language button or the country & language settings; direction flips automatically for right-to-left languages and numbers follow your language’s digits. The assistant replies in the language of your message.',
    },
    keywords: ['اللغات', 'تغيير اللغة', 'لغة الموقع', 'languages', 'change language'],
    tags: ['لغات', 'ترجمة', 'languages', 'i18n'],
  },
];

/** The features whose knowledge is new here (the curated docs above already exist in the seed). */
const PLATFORM_DOC_PREFIX = 'kb-platform-';

export function platformFeature(id: string | undefined): PlatformFeature | undefined {
  return id ? PLATFORM_FEATURES.find((f) => f.id === id) : undefined;
}

/** The same group first (the natural next questions), then the rest — suggestions, not a menu. */
export function relatedPlatformFeatures(feature: PlatformFeature, limit = 2): PlatformFeature[] {
  const sameGroup = PLATFORM_FEATURES.filter((f) => f.id !== feature.id && f.group === feature.group);
  const others = PLATFORM_FEATURES.filter((f) => f.id !== feature.id && f.group !== feature.group);
  return [...sameGroup, ...others].slice(0, limit);
}

/** Best platform feature named in the message, or undefined. Two points is the bar, so one weak word never wins. */
export function matchPlatformFeature(message: string): { feature: PlatformFeature; score: number } | undefined {
  const text = ` ${normalize(message)} `;
  let best: { feature: PlatformFeature; score: number } | undefined;
  for (const feature of PLATFORM_FEATURES) {
    let score = 0;
    for (const keyword of feature.keywords) {
      if (!matchesKeyword(text, keyword)) continue;
      // Every keyword here is curated to be specific (never a generic word), so a single word already
      // counts; a phrase («مكتبة الكتب») is a stronger signal still.
      score += keyword.includes(' ') ? 3 : 2;
    }
    if (score >= 2 && (!best || score > best.score)) best = { feature, score };
  }
  return best;
}

/** Phrases that ask for the whole map («دليل المنصة», «إيه الجديد في المنصة؟»). */
const OVERVIEW = [
  'دليل المنصة', 'مميزات المنصة', 'أدوات المنصة', 'ادوات الموقع', 'ادوات الموقع ايه', 'كل الادوات', 'اقسام المنصة', 'خريطة المنصة', 'ايه الجديد في المنصة',
  'الجديد في المنصة', 'كل حاجة عن المنصة', 'platform guide', 'site features', 'platform features', 'what is on the site',
];

export function asksForPlatformOverview(message: string): boolean {
  const text = ` ${normalize(message)} `;
  if (OVERVIEW.some((phrase) => matchesKeyword(text, phrase))) return true;
  // «إيه الأدوات اللي في الموقع؟» / «which tools are on the site?» — tools + the whole platform.
  const asksTools = /(^|\s)ال?(ادوات|أدوات|tools?)(\s|$)/.test(text);
  const wholeSite = /(^|\s)ال?(موقع|منصه|منصة|site|platform)(\s|$)/.test(text);
  return asksTools && wholeSite;
}

/** «إزاي أستخدم …؟» — used as a follow-up chip, so tapping it routes straight back here. */
export function platformQuestion(feature: PlatformFeature, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `إزاي أستخدم ${feature.name.ar}؟` : `How do I use the ${feature.name.en}?`;
}

/** A compact map for the model prompt: what exists, where it opens and what it does (no invented facts). */
export function platformCatalog(lang: 'ar' | 'en' = 'ar'): string {
  const groups = Object.keys(PLATFORM_GROUP_LABEL) as PlatformGroup[];
  return groups
    .map((group) => {
      const lines = PLATFORM_FEATURES.filter((f) => f.group === group)
        .map((f) => `  - ${f.name[lang]}${f.tab ? ` [${f.tab}]` : ''}: ${f.summary[lang]}`)
        .join('\n');
      return `${PLATFORM_GROUP_LABEL[group][lang]}:\n${lines}`;
    })
    .join('\n');
}

/** The live shipping rule (same files the storefront and the payment server use) as one prompt block. */
export function shippingBrief(lang: 'ar' | 'en' = 'ar'): string {
  const zones = [...SHIPPING.zones, SHIPPING.default]
    .map((z) => `${z.name[lang]}: ${z.firstItem} ${SHIPPING.currency} ${lang === 'ar' ? 'لأول زجاجة' : 'first bottle'} + ${z.extraItem} ${SHIPPING.currency} ${lang === 'ar' ? 'لكل زجاجة زيادة' : 'each extra bottle'}${z.days ? ` (${z.days} ${lang === 'ar' ? 'يوم تقديرياً' : 'days approx.'})` : ''}`)
    .join('; ');
  const pct = Number(SHIPPING.handling?.percent) || 0;
  const cap = Number(SHIPPING.handling?.capUsd) || 0;
  const fee = pct > 0 ? `${pct}%${cap > 0 ? ` ${lang === 'ar' ? 'بحد أقصى' : 'max'} ${cap} USD` : ''}` : (lang === 'ar' ? 'من غير هامش' : 'none');
  return lang === 'ar'
    ? `قاعدة الشحن (قرار صاحب المتجر، 2026-10-26): المكسب 50% صافي، والشحن ماياكلش منه. عشان كده الشحن لبلد الزائر = تعريفة الشركة المنشورة للمسار ده + هامش تجهيز ${fee} (بيتأكد قبل الدفع). الدول اللي لسه مفيش لها تعريفة منشورة بتاخد سعر منطقتها — وسعر أول زجاجة/الزجاجة الزيادة لكل منطقة: ${zones}. العطور مواد قابلة للاشتعال UN1266 Class 3، وبعض الدول تمنع أو تقيّد الاستيراد.`
    : `Shipping rule (the merchant's decision, 2026-10-26): the 50% margin is net — shipping never eats it. So shipping to the visitor's country = the carrier's published rate for that lane + ${fee} handling fee (confirmed before payment). Countries without a published rate take their zone price — first bottle / extra bottle per zone: ${zones}. Perfume is flammable (UN1266 Class 3); some countries restrict imports.`;
}

/** The whole map, grouped, for the built-in answer when no AI key is configured. */
export function platformOverviewText(lang: 'ar' | 'en'): string {
  const groups = Object.keys(PLATFORM_GROUP_LABEL) as PlatformGroup[];
  const body = groups
    .map((group) => {
      const names = PLATFORM_FEATURES.filter((f) => f.group === group).map((f) => f.name[lang]).join(' · ');
      return `• ${PLATFORM_GROUP_LABEL[group][lang]}: ${names}`;
    })
    .join('\n');
  const tail = lang === 'ar'
    ? '\n\nاسألني عن أي واحدة بالاسم وأنا أشرحلك خطواتها وأفتحلك صفحتها، أو قولّي «بتقدموا خدمات ايه؟» للخدمات التجارية.'
    : '\n\nName any of them and I will explain its steps and open its page, or ask “What services do you offer?” for the commercial services.';
  return (lang === 'ar' ? 'دي خريطة منصة شام الحالية:\n' : 'This is the current map of the Sham platform:\n') + body + tail;
}

/**
 * Knowledge documents for the platform features, seeded with the rest. Existing curated docs
 * (concentration, pyramid, …) are reused, never duplicated.
 */
export function platformKnowledge(): KnowledgeDoc[] {
  const updatedAt = new Date().toISOString();
  return PLATFORM_FEATURES
    .filter((f) => f.docId.startsWith(PLATFORM_DOC_PREFIX))
    .map((f): KnowledgeDoc => ({
      id: f.docId,
      title: f.name.ar,
      // The guide documents the live map — a copy of it would go stale the day a new tool ships.
      content: f.id === 'guide' ? `كل أقسام المنصة الحالية:\n${platformOverviewText('ar')}` : `${f.summary.ar} ${f.details.ar}`,
      tags: [...f.tags, f.name.en, ...f.keywords],
      updatedAt,
    }));
}
