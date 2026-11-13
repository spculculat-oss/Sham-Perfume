/**
 * «قسم مستحضرات التجميل» — every word of the cosmetics section: the hub, the formulator, the ingredient library, the
 * safety rules and the lessons. Arabic and English are written here by hand; the other site languages are filled by
 * «المترجم الذكي» (scripts/shaheen-languages), which reads each `{ ar, en }` line of this file — so keep every text on
 * ONE line. A language with no translation yet falls back to English through loc(), never to Arabic.
 */
import type { SupportedLanguage } from '../types/i18n';
import { loc, type LText } from './localize';

export const COSMETICS_UI = {
  nav: { ar: 'التجميل', en: 'Cosmetics' },
  navFull: { ar: 'قسم مستحضرات التجميل — العلم والتركيبات والمنتجات', en: 'Cosmetics section — science, formulas and products' },
  navPerfumes: { ar: 'العطور', en: 'Perfumes' },
  navPerfumesFull: { ar: 'قسم العطور — الأدوات والموسوعة والمتجر', en: 'Perfume section — tools, encyclopedia and store' },
  badge: { ar: 'قسم جديد', en: 'New section' },
  title: { ar: 'مستحضرات التجميل بعلم وتركيبات مضبوطة', en: 'Cosmetics, with real science and measured formulas' },
  subtitle: { ar: 'افهم بشرتك وشعرك، اعرف كل خامة بتعمل إيه وحدودها الآمنة، وصمّم كريمك أو سيرومك أو زبدتك بنسب ومراحل وخطوات واضحة.', en: 'Understand your skin and hair, learn what each ingredient does and its safe limits, and design your cream, serum or butter with clear percentages, phases and steps.' },
  tabFormulator: { ar: 'مصمم التركيبات', en: 'Formulator' },
  tabLibrary: { ar: 'مكتبة الخامات', en: 'Ingredient library' },
  tabScience: { ar: 'علم التجميل', en: 'Cosmetic science' },
  tabStore: { ar: 'منتجات المتجر', en: 'Store products' },
  statIngredients: { ar: 'خامة موثقة', en: 'documented ingredients' },
  statProducts: { ar: 'نوع منتج', en: 'product types' },
  statLessons: { ar: 'درس علمي', en: 'science lessons' },
  askShaheen: { ar: 'اسأل شاهين عن التجميل', en: 'Ask Shaheen about cosmetics' },
  // Formulator form
  formTitle: { ar: 'صمّم تركيبتك', en: 'Design your formula' },
  formHint: { ar: 'اختار نوع المنتج ونوع البشرة واللي محتاجه، والمصمم يحسب النسب والجرامات ويرتب المراحل والخطوات وتحذيرات السلامة.', en: 'Pick the product, the skin type and what you need; the formulator works out the percentages and grams and lays out the phases, steps and safety warnings.' },
  product: { ar: 'نوع المنتج', en: 'Product' },
  skin: { ar: 'نوع البشرة / الشعر', en: 'Skin / hair type' },
  concerns: { ar: 'الهدف', en: 'Goal' },
  batch: { ar: 'حجم التشغيلة (جرام)', en: 'Batch size (grams)' },
  scent: { ar: 'إضافة زيت عطري خفيف', en: 'Add a light essential oil' },
  nutFree: { ar: 'بدون مكسرات (حساسية)', en: 'Nut-free (allergy)' },
  vegan: { ar: 'نباتي بدون شمع النحل', en: 'Vegan, no beeswax' },
  design: { ar: 'احسب التركيبة', en: 'Work out the formula' },
  print: { ar: 'اطبع التركيبة', en: 'Print the formula' },
  copy: { ar: 'انسخ التركيبة', en: 'Copy the formula' },
  copied: { ar: 'اتنسخت', en: 'Copied' },
  // Formula sheet
  sheetTitle: { ar: 'ورقة التركيبة', en: 'Formula sheet' },
  colIngredient: { ar: 'الخامة', en: 'Ingredient' },
  colInci: { ar: 'الاسم الدولي (INCI)', en: 'INCI name' },
  colRole: { ar: 'الوظيفة', en: 'Function' },
  colPct: { ar: 'النسبة %', en: '%' },
  colGrams: { ar: 'جرام', en: 'Grams' },
  qs: { ar: 'حسب الحاجة', en: 'as needed' },
  rest: { ar: 'الباقي', en: 'to 100%' },
  total: { ar: 'الإجمالي', en: 'Total' },
  steps: { ar: 'خطوات التحضير', en: 'Method' },
  safety: { ar: 'تحذيرات السلامة', en: 'Safety warnings' },
  phTarget: { ar: 'الحموضة المطلوبة (pH)', en: 'Target pH' },
  heat: { ar: 'درجة التسخين', en: 'Heating' },
  noHeat: { ar: 'من غير تسخين', en: 'No heating' },
  shelf: { ar: 'الصلاحية التقريبية', en: 'Approximate shelf life' },
  months: { ar: 'شهور', en: 'months' },
  checksOk: { ar: 'كل النسب جوه الحدود الآمنة والمجموع 100%', en: 'Every level is within its safe limit and the total is 100%' },
  checksBad: { ar: 'فيه نسبة محتاجة مراجعة', en: 'A level needs reviewing' },
  trial: { ar: 'تركيبة تعليمية لتشغيلة صغيرة — مش منتج للبيع قبل اختبار الثبات والسلامة والتسجيل.', en: 'A teaching formula for a small batch — not a product for sale before stability and safety testing and registration.' },
  // Library
  libraryTitle: { ar: 'مكتبة خامات التجميل', en: 'Cosmetic ingredient library' },
  libraryHint: { ar: 'كل خامة: بتعمل إيه، نسبتها المعتادة، أقصى نسبة، وملاحظات السلامة.', en: 'Every ingredient: what it does, its usual level, its maximum and its safety notes.' },
  search: { ar: 'دوّر على خامة…', en: 'Search an ingredient…' },
  allRoles: { ar: 'كل الوظائف', en: 'All functions' },
  typical: { ar: 'النسبة المعتادة', en: 'Usual level' },
  maxLevel: { ar: 'أقصى نسبة', en: 'Maximum' },
  faceMax: { ar: 'أقصى نسبة للوجه', en: 'Face maximum' },
  phaseLabel: { ar: 'المرحلة', en: 'Phase' },
  flagSensitiser: { ar: 'ممكن يهيّج البشرة الحساسة', en: 'Can irritate sensitive skin' },
  flagNut: { ar: 'مصدره مكسرات', en: 'Nut origin' },
  flagComedogenic: { ar: 'ممكن يسد المسام', en: 'Can clog pores' },
  flagHeat: { ar: 'يتضاف بعد التبريد', en: 'Added after cooling' },
  noMatch: { ar: 'مفيش خامة بالاسم ده', en: 'No ingredient by that name' },
  // Science
  scienceTitle: { ar: 'علم مستحضرات التجميل', en: 'Cosmetic science' },
  scienceHint: { ar: 'دروس خبير التجميل في مدرسة شاهين: البشرة والشعر والخامات والسلامة.', en: 'Lessons from the cosmetics expert of Shaheen’s school: skin, hair, ingredients and safety.' },
  expert: { ar: 'خبير مستحضرات التجميل', en: 'Cosmetics expert' },
  // Store
  storeTitle: { ar: 'منتجات التجميل في متجر شام', en: 'Cosmetics in the Sham store' },
  comingSoon: { ar: 'قريباً', en: 'Coming soon' },
  comingSoonText: { ar: 'بنجهّز منتجات التجميل دلوقتي بنفس معايير العطور: سعر واضح بعملة بلدك والشحن محسوب. لحد ما توصل، استخدم المصمم والمكتبة.', en: 'Cosmetic products are being prepared now to the same standard as the perfumes: a clear price in your currency with shipping included. Until they arrive, use the formulator and the library.' },
  openStore: { ar: 'افتح المتجر', en: 'Open the store' },
  sectionAll: { ar: 'كل الأقسام', en: 'All sections' },
  sectionPerfumes: { ar: 'العطور', en: 'Perfumes' },
  sectionCosmetics: { ar: 'مستحضرات التجميل', en: 'Cosmetics' },
  // Home mix
  homeTitle: { ar: 'شام: عالم العطور ومستحضرات التجميل', en: 'Sham: the world of perfumes and cosmetics' },
  homeSubtitle: { ar: 'قسمين بنفس المعايير: علم موثّق، أدوات تصميم دقيقة، ومتجر بأسعار واضحة.', en: 'Two sections, one standard: documented science, precise design tools and a store with clear prices.' },
  perfumeCardText: { ar: 'حاسبة التركيز، موسوعة الخامات، هرم النوتات، مكتبة التركيبات، والمتجر.', en: 'Concentration calculator, materials encyclopedia, notes pyramid, formula library and the store.' },
  cosmeticCardText: { ar: 'مصمم الكريمات والسيرومات والزبدات، مكتبة الخامات بحدودها الآمنة، ودروس البشرة والشعر.', en: 'Formulator for creams, serums and butters, the ingredient library with safe limits, and skin and hair lessons.' },
  enter: { ar: 'ادخل القسم', en: 'Enter the section' },
  featured: { ar: 'مختارات من القسمين', en: 'Featured from both sections' },
  perfumeTools: { ar: 'أدوات العطور', en: 'Perfume tools' },
  cosmeticTools: { ar: 'أدوات التجميل', en: 'Cosmetic tools' },
} satisfies Record<string, LText>;

export type CosmeticsUiKey = keyof typeof COSMETICS_UI;
export const cosmeticsText = (lang: SupportedLanguage, key: CosmeticsUiKey): string => loc(lang, COSMETICS_UI[key]);

export const COSMETIC_PRODUCT_TEXT: Record<string, { name: LText; about: LText }> = {
  face_cream: { name: { ar: 'كريم مرطب للوجه', en: 'Face moisturising cream' }, about: { ar: 'مستحلب زيت في ماء خفيف بيرطب ومايسيبش لمعة.', en: 'A light oil-in-water emulsion that moisturises without shine.' } },
  body_lotion: { name: { ar: 'لوشن الجسم', en: 'Body lotion' }, about: { ar: 'مستحلب أسيل بيتفرد بسرعة على مساحات كبيرة.', en: 'A fluid emulsion that spreads fast over large areas.' } },
  gel_serum: { name: { ar: 'سيروم جل مائي', en: 'Water-gel serum' }, about: { ar: 'سيروم خفيف من غير زيوت، مكانه بعد الغسيل وقبل الكريم.', en: 'An oil-free light serum, used after cleansing and before cream.' } },
  face_oil: { name: { ar: 'زيت الوجه', en: 'Face oil' }, about: { ar: 'خلطة زيوت من غير ماء، بتتحط نقط قليلة على بشرة رطبة.', en: 'A water-free oil blend, a few drops on damp skin.' } },
  body_butter: { name: { ar: 'زبدة الجسم المخفوقة', en: 'Whipped body butter' }, about: { ar: 'زبدات وزيوت مخفوقة للبشرة الجافة جداً، من غير ماء.', en: 'Whipped butters and oils for very dry skin, water-free.' } },
  lip_balm: { name: { ar: 'مرطب الشفايف', en: 'Lip balm' }, about: { ar: 'شمع وزبدة وزيوت بتحمي الشفايف من التشقق.', en: 'Wax, butter and oils that protect lips from chapping.' } },
  hair_oil: { name: { ar: 'زيت الشعر', en: 'Hair oil' }, about: { ar: 'خلطة زيوت للأطراف وفروة الرأس قبل الغسيل.', en: 'An oil blend for the lengths and scalp before washing.' } },
  face_wash: { name: { ar: 'غسول وجه لطيف', en: 'Gentle face wash' }, about: { ar: 'جل منظف بمنظفات لطيفة من أصل نباتي وحموضة مضبوطة.', en: 'A cleansing gel with mild plant-derived surfactants and a balanced pH.' } },
};

export const COSMETIC_SKIN_TEXT: Record<string, LText> = {
  normal: { ar: 'عادية', en: 'Normal' },
  dry: { ar: 'جافة', en: 'Dry' },
  oily: { ar: 'دهنية', en: 'Oily' },
  combination: { ar: 'مختلطة', en: 'Combination' },
  sensitive: { ar: 'حساسة', en: 'Sensitive' },
};

export const COSMETIC_CONCERN_TEXT: Record<string, LText> = {
  hydration: { ar: 'ترطيب', en: 'Hydration' },
  glow: { ar: 'نضارة وتوحيد اللون', en: 'Glow and even tone' },
  acne: { ar: 'بشرة معرضة للحبوب', en: 'Blemish-prone' },
  soothing: { ar: 'تهدئة الاحمرار', en: 'Soothing redness' },
  aging: { ar: 'خطوط رفيعة', en: 'Fine lines' },
};

export const COSMETIC_PHASE_TEXT: Record<'A' | 'B' | 'C', LText> = {
  A: { ar: 'المرحلة (أ): المائية', en: 'Phase A: water phase' },
  B: { ar: 'المرحلة (ب): الزيتية', en: 'Phase B: oil phase' },
  C: { ar: 'المرحلة (ج): بعد التبريد (أقل من 40°م)', en: 'Phase C: cool-down (below 40 °C)' },
};

export const COSMETIC_ROLE_TEXT: Record<string, LText> = {
  solvent: { ar: 'مذيب / أساس مائي', en: 'Solvent / water base' },
  humectant: { ar: 'جاذب للرطوبة', en: 'Humectant' },
  soothing: { ar: 'مهدئ', en: 'Soothing' },
  active: { ar: 'مادة فعالة', en: 'Active' },
  thickener: { ar: 'مكثف', en: 'Thickener' },
  chelator: { ar: 'مثبت معادن', en: 'Chelator' },
  oil: { ar: 'زيت مطري', en: 'Emollient oil' },
  butter: { ar: 'زبدة', en: 'Butter' },
  wax: { ar: 'شمع', en: 'Wax' },
  fatty_alcohol: { ar: 'كحول دهني (قوام)', en: 'Fatty alcohol (body)' },
  emulsifier: { ar: 'مستحلب', en: 'Emulsifier' },
  surfactant: { ar: 'منظف لطيف', en: 'Mild surfactant' },
  antioxidant: { ar: 'مضاد أكسدة', en: 'Antioxidant' },
  preservative: { ar: 'مادة حافظة', en: 'Preservative' },
  ph_adjuster: { ar: 'ضبط الحموضة', en: 'pH adjuster' },
  essential_oil: { ar: 'زيت عطري', en: 'Essential oil' },
};

/** What each ingredient is and the line not to cross. Keyed by the ids of src/utils/cosmeticIngredients.ts. */
export const COSMETIC_INGREDIENT_TEXT: Record<string, { name: LText; does: LText; note: LText }> = {
  water: { name: { ar: 'ماء مقطر', en: 'Distilled water' }, does: { ar: 'أساس كل منتج مائي وبيذيب الخامات المائية.', en: 'The base of every water-based product; dissolves the water-soluble ingredients.' }, note: { ar: 'مقطر أو منزوع الأيونات بس، ومية الحنفية ممنوعة. وجود الماء معناه إن المادة الحافظة إجبارية.', en: 'Distilled or deionised only, never tap water. Water means a preservative is mandatory.' } },
  rose_water: { name: { ar: 'ماء الورد الدمشقي', en: 'Damask rose water' }, does: { ar: 'بيحل محل جزء من الماء ويدي ريحة خفيفة وإحساس منعش.', en: 'Replaces part of the water and gives a soft scent and a fresh feel.' }, note: { ar: 'يكون نقي من غير كحول أو عطر مضاف، وبيحتاج حافظة زي الماء بالظبط.', en: 'Pure, with no added alcohol or fragrance; it needs a preservative exactly like water.' } },
  aloe: { name: { ar: 'عصير الصبار', en: 'Aloe vera juice' }, does: { ar: 'مهدئ ومرطب خفيف للبشرة المتهيجة.', en: 'Soothing and lightly hydrating for irritated skin.' }, note: { ar: 'استخدم المنتج المصنع للتجميل مش الصبار الطازج من البيت لأنه بيبوظ بسرعة.', en: 'Use cosmetic-grade juice, not fresh home aloe, which spoils fast.' } },
  glycerin: { name: { ar: 'جلسرين', en: 'Glycerin' }, does: { ar: 'بيشد الرطوبة للجلد ويحافظ عليها.', en: 'Draws moisture into the skin and holds it.' }, note: { ar: 'فوق 5–7% بيبقى لزج على الجلد.', en: 'Above 5–7% it feels sticky.' } },
  propanediol: { name: { ar: 'بروبانديول', en: 'Propanediol' }, does: { ar: 'جاذب رطوبة أخف من الجلسرين وبيساعد على إذابة الخامات.', en: 'A lighter humectant than glycerin that helps dissolve ingredients.' }, note: { ar: 'آمن عموماً، وفي نسب عالية ممكن يسبب وخز بسيط.', en: 'Generally safe; at high levels it can sting slightly.' } },
  hyaluronic: { name: { ar: 'حمض الهيالورونيك (بودرة)', en: 'Hyaluronic acid (powder)' }, does: { ar: 'بيمسك كمية كبيرة من الماء ويدي إحساس امتلاء ونعومة.', en: 'Holds a lot of water and gives a plump, smooth feel.' }, note: { ar: 'يتبل في الجلسرين الأول عشان مايتكتلش، وأكتر من 1% بيبقى لزج.', en: 'Pre-wet it in glycerin so it doesn’t clump; above 1% it turns sticky.' } },
  allantoin: { name: { ar: 'ألانتوين', en: 'Allantoin' }, does: { ar: 'مهدئ وبيساعد على نعومة الجلد.', en: 'Soothing and helps skin feel smooth.' }, note: { ar: 'مايذوبش كويس فوق 0.5%، فمتزودهوش.', en: 'It does not dissolve well above 0.5%, so don’t exceed it.' } },
  xanthan: { name: { ar: 'صمغ الزانثان', en: 'Xanthan gum' }, does: { ar: 'بيكثف المرحلة المائية ويثبت المستحلب.', en: 'Thickens the water phase and stabilises the emulsion.' }, note: { ar: 'يتبل في الجلسرين قبل الماء، والزيادة بتدي قوام مطاطي.', en: 'Disperse it in glycerin before the water; too much gives a slimy feel.' } },
  phytate: { name: { ar: 'فيتات الصوديوم', en: 'Sodium phytate' }, does: { ar: 'بيمسك معادن الماء فيقوي الحافظة ويحمي الزيوت من التزنخ.', en: 'Binds metals in the water, boosting the preservative and protecting oils from going rancid.' }, note: { ar: 'نسبة صغيرة جداً بتكفي.', en: 'A very small amount is enough.' } },
  decyl_glucoside: { name: { ar: 'ديسيل جلوكوسيد', en: 'Decyl glucoside' }, does: { ar: 'منظف لطيف من أصل نباتي بيعمل رغوة خفيفة.', en: 'A mild plant-derived cleanser with gentle foam.' }, note: { ar: 'قلوي، فلازم تضبط حموضة الغسول بعده لحوالي 5.5.', en: 'It is alkaline, so the wash must be brought down to about pH 5.5.' } },
  betaine: { name: { ar: 'كوكاميدوبروبيل بيتين', en: 'Cocamidopropyl betaine' }, does: { ar: 'منظف مساعد بيخفف حدة المنظفات ويزود الرغوة.', en: 'A co-cleanser that softens the others and boosts foam.' }, note: { ar: 'نادراً ما يسبب حساسية؛ اختبار الرقعة مهم.', en: 'Rarely sensitising; the patch test still matters.' } },
  jojoba: { name: { ar: 'زيت الجوجوبا', en: 'Jojoba oil' }, does: { ar: 'شمع سائل قريب من دهون الجلد، مناسب لكل الأنواع.', en: 'A liquid wax close to skin’s own oils, suits all skin types.' }, note: { ar: 'ثابت ومابيتزنخش بسهولة.', en: 'Stable; slow to go rancid.' } },
  argan: { name: { ar: 'زيت الأرجان', en: 'Argan oil' }, does: { ar: 'مغذي للبشرة الجافة والشعر.', en: 'Nourishing for dry skin and hair.' }, note: { ar: 'من نواة شجرة الأرجان؛ اللي عندهم حساسية مكسرات يجربوا بحذر.', en: 'From the argan kernel; people with nut allergies should be careful.' } },
  almond: { name: { ar: 'زيت اللوز الحلو', en: 'Sweet almond oil' }, does: { ar: 'زيت ناعم ومتوازن للجسم والبشرة الجافة.', en: 'A soft, balanced oil for body and dry skin.' }, note: { ar: 'مصدره مكسرات: ممنوع لحساسية اللوز.', en: 'Nut origin: avoid with almond allergy.' } },
  squalane: { name: { ar: 'سكوالان نباتي', en: 'Plant squalane' }, does: { ar: 'مطري خفيف جداً من غير لمعة، مناسب للبشرة الدهنية والحساسة.', en: 'A very light, non-shiny emollient for oily and sensitive skin.' }, note: { ar: 'ثابت جداً ونادراً ما يهيج.', en: 'Very stable and rarely irritating.' } },
  grapeseed: { name: { ar: 'زيت بذر العنب', en: 'Grapeseed oil' }, does: { ar: 'زيت خفيف بيتشرب بسرعة.', en: 'A light oil that absorbs quickly.' }, note: { ar: 'بيتأكسد أسرع، فيتحفظ بعيد عن الحرارة ومعاه فيتامين E.', en: 'Oxidises faster; keep it away from heat and add vitamin E.' } },
  rosehip: { name: { ar: 'زيت ثمر الورد', en: 'Rosehip oil' }, does: { ar: 'غني بالأحماض الدهنية الأساسية للبشرة المجهدة.', en: 'Rich in essential fatty acids for tired skin.' }, note: { ar: 'حساس للحرارة والضوء: يتضاف بعد التبريد ويتحفظ في عبوة غامقة.', en: 'Heat- and light-sensitive: add after cooling and store in a dark bottle.' } },
  olive: { name: { ar: 'زيت الزيتون', en: 'Olive oil' }, does: { ar: 'مغذي وتقيل للجسم والبشرة الجافة جداً.', en: 'Rich and nourishing for body and very dry skin.' }, note: { ar: 'ممكن يسد المسام في الوش المعرض للحبوب.', en: 'Can clog pores on blemish-prone faces.' } },
  cct: { name: { ar: 'زيت جوز الهند المجزأ', en: 'Fractionated coconut oil' }, does: { ar: 'زيت خفيف شفاف ثابت جداً بيحسن الانتشار.', en: 'A light, clear, very stable oil that improves spread.' }, note: { ar: 'مختلف عن زيت جوز الهند الصلب ومابيسدش المسام بنفس الدرجة.', en: 'Different from solid coconut oil and far less pore-clogging.' } },
  castor: { name: { ar: 'زيت الخروع', en: 'Castor oil' }, does: { ar: 'تقيل ولامع، بيدي لمعة لمرطب الشفايف وبيستخدم للشعر.', en: 'Thick and glossy; gives lip balm its shine and is used on hair.' }, note: { ar: 'لزج، فبنستخدمه بنسبة محدودة.', en: 'Sticky, so it is used in moderation.' } },
  black_seed: { name: { ar: 'زيت حبة البركة', en: 'Black seed oil' }, does: { ar: 'زيت تقليدي لفروة الرأس والبشرة بريحة قوية.', en: 'A traditional scalp and skin oil with a strong smell.' }, note: { ar: 'ممكن يسبب تهيج أو حساسية؛ نسبة قليلة واختبار رقعة.', en: 'Can irritate or sensitise; keep it low and patch-test.' } },
  shea: { name: { ar: 'زبدة الشيا', en: 'Shea butter' }, does: { ar: 'زبدة مغذية بتقفل الرطوبة للبشرة الجافة.', en: 'A nourishing butter that seals in moisture for dry skin.' }, note: { ar: 'ممكن تبقى محببة لو بردت ببطء؛ سخنها وبعدين برّد بسرعة.', en: 'Can turn grainy if cooled slowly; heat it, then cool it fast.' } },
  cocoa: { name: { ar: 'زبدة الكاكاو', en: 'Cocoa butter' }, does: { ar: 'زبدة صلبة بتدي قوام وتماسك للمرطبات والبلسم.', en: 'A hard butter that gives body to balms and butters.' }, note: { ar: 'ريحتها شوكولاتة، وممكن تسد المسام في الوش.', en: 'Smells of chocolate and can clog pores on the face.' } },
  mango: { name: { ar: 'زبدة المانجو', en: 'Mango butter' }, does: { ar: 'زبدة ناعمة أخف من الشيا وبديل لها من غير مكسرات.', en: 'A soft butter, lighter than shea and a nut-free alternative.' }, note: { ar: 'تحمّل حرارة متوسط.', en: 'Moderate heat tolerance.' } },
  beeswax: { name: { ar: 'شمع النحل', en: 'Beeswax' }, does: { ar: 'بيدي صلابة للبلسم ويعمل طبقة حماية.', en: 'Hardens balms and forms a protective layer.' }, note: { ar: 'مش نباتي، والبديل شمع الكانديليلا بنص الكمية تقريباً.', en: 'Not vegan; candelilla wax at about half the amount replaces it.' } },
  candelilla: { name: { ar: 'شمع الكانديليلا', en: 'Candelilla wax' }, does: { ar: 'شمع نباتي أصلب من شمع النحل.', en: 'A plant wax harder than beeswax.' }, note: { ar: 'استخدم حوالي نص كمية شمع النحل.', en: 'Use about half the beeswax amount.' } },
  cetyl: { name: { ar: 'كحول السيتيل', en: 'Cetyl alcohol' }, does: { ar: 'كحول دهني بيدي الكريم قوام ونعومة، مش كحول بيجفف.', en: 'A fatty alcohol that gives cream body and silkiness — not a drying alcohol.' }, note: { ar: 'الزيادة بتعمل أثر أبيض عند الفرد.', en: 'Too much leaves a white soaping effect.' } },
  olive_emulsifier: { name: { ar: 'مستحلب الزيتون', en: 'Olive emulsifier' }, does: { ar: 'مستحلب من أصل زيتون بيربط الماء بالزيت في كريم ثابت.', en: 'An olive-derived emulsifier that binds water and oil into a stable cream.' }, note: { ar: 'محتاج تسخين المرحلتين لحوالي 70–75°م.', en: 'Both phases must be heated to about 70–75 °C.' } },
  ewax: { name: { ar: 'شمع الاستحلاب', en: 'Emulsifying wax' }, does: { ar: 'مستحلب سهل وموفر لكريمات ولوشنات ثابتة.', en: 'An easy, economical emulsifier for stable creams and lotions.' }, note: { ar: 'بيحتاج تسخين زي مستحلب الزيتون.', en: 'Needs heating like the olive emulsifier.' } },
  panthenol: { name: { ar: 'بانثينول (بروفيتامين B5)', en: 'Panthenol (pro-vitamin B5)' }, does: { ar: 'مهدئ ومرطب وبيقوي حاجز الجلد.', en: 'Soothing, hydrating and supports the skin barrier.' }, note: { ar: 'يتضاف بعد التبريد.', en: 'Added at cool-down.' } },
  niacinamide: { name: { ar: 'نياسيناميد (فيتامين B3)', en: 'Niacinamide (vitamin B3)' }, does: { ar: 'بيساعد على توحيد اللون وتنظيم الدهون وتقوية الحاجز.', en: 'Helps even tone, balance oil and strengthen the barrier.' }, note: { ar: 'ابدأ بـ 2–4%؛ أعلى من 5% ممكن يحمّر البشرة الحساسة.', en: 'Start at 2–4%; above 5% it can redden sensitive skin.' } },
  zinc_pca: { name: { ar: 'زنك PCA', en: 'Zinc PCA' }, does: { ar: 'بيساعد على تنظيم الدهون للبشرة المعرضة للحبوب.', en: 'Helps balance oil for blemish-prone skin.' }, note: { ar: 'مابيعالجش حب الشباب؛ الحالات الشديدة مكانها طبيب الجلدية.', en: 'It does not treat acne; severe cases belong with a dermatologist.' } },
  urea: { name: { ar: 'يوريا', en: 'Urea' }, does: { ar: 'مرطب قوي للبشرة الجافة والخشنة.', en: 'A strong moisturiser for dry, rough skin.' }, note: { ar: 'ممكن يلسع على الجروح والتشققات، وممنوع على وش الأطفال.', en: 'Can sting on cracks and cuts; keep off children’s faces.' } },
  bisabolol: { name: { ar: 'بيسابولول', en: 'Bisabolol' }, does: { ar: 'مهدئ مستخلص من البابونج.', en: 'A soothing compound from chamomile.' }, note: { ar: 'يذوب في الزيت.', en: 'Oil-soluble.' } },
  vitamin_e: { name: { ar: 'فيتامين E', en: 'Vitamin E' }, does: { ar: 'مضاد أكسدة بيحمي الزيوت من التزنخ.', en: 'An antioxidant that protects oils from going rancid.' }, note: { ar: 'مش مادة حافظة ومايمنعش البكتيريا والعفن.', en: 'It is not a preservative and does not stop bacteria or mould.' } },
  preservative: { name: { ar: 'مادة حافظة واسعة المدى', en: 'Broad-spectrum preservative' }, does: { ar: 'بتمنع البكتيريا والفطريات والعفن في أي منتج فيه ماء.', en: 'Stops bacteria, yeast and mould in any product that contains water.' }, note: { ar: 'إجبارية مع الماء. فينوكسي إيثانول حده الأقصى 1% في اللائحة الأوروبية.', en: 'Mandatory with water. Phenoxyethanol is capped at 1% in the EU regulation.' } },
  citric: { name: { ar: 'حمض الستريك (محلول 10%)', en: 'Citric acid (10% solution)' }, does: { ar: 'بيضبط الحموضة لحد الرقم المطلوب.', en: 'Brings the pH down to the target.' }, note: { ar: 'نقطة نقطة مع القياس بشرائط أو جهاز pH.', en: 'Drop by drop, checking with pH strips or a meter.' } },
  lavender: { name: { ar: 'زيت اللافندر العطري', en: 'Lavender essential oil' }, does: { ar: 'ريحة هادية خفيفة.', en: 'A soft, calming scent.' }, note: { ar: 'فيه لينالول (مسبب حساسية معروف): أقصى 0.5% للوش و1% للجسم، وبعيد عن الحوامل والأطفال الصغار.', en: 'Contains linalool, a known allergen: max 0.5% on the face and 1% on the body; avoid in pregnancy and young children.' } },
  tea_tree: { name: { ar: 'زيت شجرة الشاي', en: 'Tea tree oil' }, does: { ar: 'زيت عطري بيستخدم في منتجات البشرة الدهنية.', en: 'An essential oil used in products for oily skin.' }, note: { ar: 'لما يتأكسد بيهيج الجلد: يتحفظ مقفول وبارد، وأقصى 0.5% للوش.', en: 'It sensitises when oxidised: keep it closed and cool; max 0.5% on the face.' } },
};

/** The method of each kind of product, step by step. */
export const COSMETIC_STEPS: Record<string, LText[]> = {
  emulsion: [
    { ar: 'عقّم كل الأدوات والعبوات بكحول 70% وسيبها تنشف، والبس جوانتي.', en: 'Sanitise every tool and container with 70% alcohol, let them dry, and wear gloves.' },
    { ar: 'في كوب حراري: بلّ الزانثان والهيالورونيك في الجلسرين الأول، وبعدين ضيف باقي المرحلة (أ).', en: 'In a heatproof beaker, wet the xanthan and hyaluronic acid in the glycerin first, then add the rest of phase A.' },
    { ar: 'في كوب تاني: وزّن المرحلة (ب) — الزيوت والزبدات والمستحلب وكحول السيتيل.', en: 'In a second beaker, weigh phase B — oils, butters, emulsifier and cetyl alcohol.' },
    { ar: 'سخّن الكوبين في حمام مائي لحد 70–75°م واثبت على الحرارة دي حوالي 20 دقيقة.', en: 'Heat both beakers in a water bath to 70–75 °C and hold them there for about 20 minutes.' },
    { ar: 'صب المرحلة (ب) على (أ) واخلط بالخلاط اليدوي دقيقة أو اتنين لحد ما يبيض ويتماسك.', en: 'Pour phase B into phase A and blend with a stick blender for one to two minutes until white and smooth.' },
    { ar: 'كمّل تقليب هادي وهو بيبرد.', en: 'Keep stirring gently while it cools.' },
    { ar: 'لما الحرارة تنزل تحت 40°م ضيف خامات المرحلة (ج) واحدة واحدة مع التقليب.', en: 'Below 40 °C, add the phase C ingredients one at a time, stirring after each.' },
    { ar: 'قيس الحموضة واضبطها بحمض الستريك نقطة نقطة لحد الرقم المطلوب.', en: 'Measure the pH and adjust it drop by drop with citric acid to the target.' },
    { ar: 'عبّي في عبوة نظيفة ويفضل بمضخة، واكتب الاسم وتاريخ التشغيلة.', en: 'Fill a clean container, ideally a pump, and label it with the name and batch date.' },
  ],
  gel: [
    { ar: 'عقّم كل الأدوات والعبوات بكحول 70% وسيبها تنشف.', en: 'Sanitise every tool and container with 70% alcohol and let them dry.' },
    { ar: 'اعمل عجينة من الزانثان والهيالورونيك في الجلسرين والبروبانديول.', en: 'Make a slurry of the xanthan and hyaluronic acid in the glycerin and propanediol.' },
    { ar: 'ضيف العجينة على الماء والصبار مع التقليب، وسيبها 30 دقيقة لحد ما تبقى جل ناعم.', en: 'Add the slurry to the water and aloe while stirring, and leave it 30 minutes to become a smooth gel.' },
    { ar: 'دوّب الألانتوين والفيتات وقلّب كويس.', en: 'Dissolve the allantoin and phytate and stir well.' },
    { ar: 'ضيف خامات المرحلة (ج) واحدة واحدة.', en: 'Add the phase C ingredients one at a time.' },
    { ar: 'قيس الحموضة واضبطها، وبعدين عبّي في زجاجة بقطارة واكتب التاريخ.', en: 'Check and adjust the pH, then fill a dropper bottle and write the date.' },
  ],
  anhydrous_oil: [
    { ar: 'عقّم الأدوات بكحول 70% وسيبها تنشف تماماً؛ ممنوع أي نقطة ماء.', en: 'Sanitise the tools with 70% alcohol and let them dry completely; not a drop of water.' },
    { ar: 'وزّن الزيوت في كوب نظيف واخلطها بهدوء من غير تسخين.', en: 'Weigh the oils into a clean beaker and mix gently without heating.' },
    { ar: 'ضيف فيتامين E (والزيت العطري لو موجود) وقلّب.', en: 'Add the vitamin E (and the essential oil if any) and stir.' },
    { ar: 'عبّي في زجاجة غامقة بقطارة، واكتب الاسم والتاريخ.', en: 'Fill a dark dropper bottle and label it with the name and date.' },
  ],
  butter: [
    { ar: 'عقّم الأدوات بكحول 70% وسيبها تنشف تماماً.', en: 'Sanitise the tools with 70% alcohol and let them dry completely.' },
    { ar: 'سيّح الزبدات في حمام مائي على 70–75°م حوالي 20 دقيقة عشان ماتبقاش محببة.', en: 'Melt the butters in a water bath at 70–75 °C for about 20 minutes so they don’t turn grainy.' },
    { ar: 'شيلها من على النار وضيف الزيوت السايلة.', en: 'Take it off the heat and add the liquid oils.' },
    { ar: 'برّدها في التلاجة 20–30 دقيقة لحد ما تبقى نص جامدة.', en: 'Chill it in the fridge for 20–30 minutes until half set.' },
    { ar: 'ضيف فيتامين E (والزيت العطري لو موجود) واخفق بالمضرب 5–10 دقايق لحد ما تبقى هشة.', en: 'Add the vitamin E (and essential oil if any) and whip for 5–10 minutes until fluffy.' },
    { ar: 'عبّي في برطمان نظيف واكتب التاريخ، واستخدم معلقة نظيفة مش صوابعك.', en: 'Fill a clean jar and date it; use a clean spatula, not your fingers.' },
  ],
  balm: [
    { ar: 'عقّم الأدوات والأنابيب بكحول 70% وسيبها تنشف.', en: 'Sanitise the tools and tubes with 70% alcohol and let them dry.' },
    { ar: 'سيّح الشمع والزبدات في حمام مائي على حوالي 70°م.', en: 'Melt the wax and butters in a water bath at about 70 °C.' },
    { ar: 'ضيف الزيوت وقلّب لحد ما الخليط يبقى شفاف.', en: 'Add the oils and stir until the mixture is clear.' },
    { ar: 'شيله من النار وضيف فيتامين E.', en: 'Take it off the heat and add the vitamin E.' },
    { ar: 'صبه بسرعة في الأنابيب وسيبه يبرد على حرارة الأوضة قبل ما تقفلها.', en: 'Pour quickly into the tubes and let it cool at room temperature before capping.' },
  ],
  wash: [
    { ar: 'عقّم كل الأدوات والعبوات بكحول 70% وسيبها تنشف.', en: 'Sanitise every tool and container with 70% alcohol and let them dry.' },
    { ar: 'اعمل عجينة من الزانثان في الجلسرين وضيفها على الماء والصبار، وسيبها تتحول جل.', en: 'Make a slurry of the xanthan in the glycerin, add it to the water and aloe, and let it gel.' },
    { ar: 'ضيف المنظفات ببطء وقلّب بهدوء عشان ماتعملش رغوة كتير.', en: 'Add the surfactants slowly and stir gently to avoid foaming.' },
    { ar: 'ضيف خامات المرحلة (ج).', en: 'Add the phase C ingredients.' },
    { ar: 'المنظفات دي قلوية: نزّل الحموضة بحمض الستريك لحد 5–5.5 وقيسها بشرائط أو جهاز.', en: 'These surfactants are alkaline: bring the pH down to 5–5.5 with citric acid and check with strips or a meter.' },
    { ar: 'عبّي في عبوة بمضخة واكتب التاريخ.', en: 'Fill a pump bottle and date it.' },
  ],
};

/** The safety warnings a formula carries; which ones apply is decided by the formulator. */
export const COSMETIC_WARNINGS: Record<string, LText> = {
  patch_test: { ar: 'اختبار الرقعة إجباري: حط كمية صغيرة على باطن الدراع أو ورا الودن واستنى 24–48 ساعة؛ لو حصل احمرار أو هرش أو حرقان متستخدموش.', en: 'A patch test is a must: put a little on the inner forearm or behind the ear and wait 24–48 hours; if there is redness, itching or burning, don’t use it.' },
  preservative_required: { ar: 'التركيبة فيها ماء، فالمادة الحافظة إجبارية ومتتشالش أبداً؛ من غيرها البكتيريا والعفن بيظهروا في أيام حتى لو مش باينين.', en: 'This formula contains water, so the preservative is mandatory and never removed; without it bacteria and mould grow within days, even when invisible.' },
  vitamin_e_not_preservative: { ar: 'فيتامين E والزيوت العطرية مش مواد حافظة ومايغنوش عنها.', en: 'Vitamin E and essential oils are not preservatives and cannot replace one.' },
  hygiene: { ar: 'النظافة نص التركيبة: أدوات معقمة، ماء مقطر، جوانتي، وميزان بيقيس لحد 0.01 جرام للكميات الصغيرة.', en: 'Hygiene is half the formula: sanitised tools, distilled water, gloves, and a scale that reads to 0.01 g for small amounts.' },
  ph_check: { ar: 'قيس الحموضة قبل الاستخدام؛ الحافظة والخامات الفعالة بتشتغل صح بس في المدى المكتوب.', en: 'Check the pH before use; the preservative and actives only work properly within the stated range.' },
  shelf_water: { ar: 'حتى مع الحافظة: استخدمه خلال حوالي 3 شهور، ولو الريحة أو اللون أو القوام اتغير ارميه.', en: 'Even with a preservative, use it within about 3 months, and throw it away if the smell, colour or texture changes.' },
  shelf_anhydrous: { ar: 'من غير ماء بيعيش أطول (6–12 شهر)، بس أي نقطة ماء جواه بتبوظه؛ خليه ناشف ومقفول وبعيد عن الحمام.', en: 'Without water it lasts longer (6–12 months), but any drop of water spoils it; keep it dry, closed and out of the shower.' },
  essential_oils: { ar: 'الزيوت العطرية مركزة: ملتزمين بأقصى 0.5% للوش و1% للجسم، وممنوعة للحوامل والمرضعات والأطفال تحت 6 سنين إلا باستشارة طبيب.', en: 'Essential oils are concentrated: we keep to 0.5% on the face and 1% on the body, and avoid them in pregnancy, breastfeeding and children under 6 unless a doctor agrees.' },
  sensitive_no_scent: { ar: 'للبشرة الحساسة شلنا أي ريحة أو زيت عطري لأنهم أكتر سبب للحساسية في مستحضرات التجميل.', en: 'For sensitive skin we left out all scent and essential oils, the most common cause of cosmetic allergies.' },
  nut_allergy: { ar: 'فيه خامات من أصل مكسرات؛ لو عندك حساسية مكسرات اختار «بدون مكسرات».', en: 'Some ingredients are of nut origin; with a nut allergy choose “nut-free”.' },
  eyes: { ar: 'بعيد عن العين؛ لو دخل فيها اغسلها بمية كتير.', en: 'Keep away from the eyes; if it gets in, rinse with plenty of water.' },
  not_sunscreen: { ar: 'ده مش واقي شمس. الواقي متعملوش في البيت أبداً لأن رقم الحماية محتاج اختبار معملي؛ استخدم واقي مسجل.', en: 'This is not a sunscreen. Never make sunscreen at home — its SPF needs lab testing; use a registered one.' },
  niacinamide_start: { ar: 'النياسيناميد فوق 4%: ابدأ يوم آه ويوم لأ أول أسبوعين.', en: 'Niacinamide above 4%: use it every other day for the first two weeks.' },
  lips: { ar: 'مرطب الشفايف من غير زيوت عطرية لأنه بيتبلع جزء منه وبيهيج الشفايف.', en: 'The lip balm has no essential oils: part of it is swallowed and they irritate lips.' },
  not_medicine: { ar: 'مستحضر تجميل مش دواء: مابيعالجش أمراض جلدية، والإكزيما والحبوب الشديدة والجروح مكانها طبيب الجلدية.', en: 'A cosmetic, not a medicine: it treats no skin disease; eczema, severe acne and wounds belong with a dermatologist.' },
  selling: { ar: 'لو ناوي تبيع: لازم اختبار ثبات واختبار تحدي للحافظة وتسجيل عند الجهة المختصة في بلدك (في مصر هيئة الدواء المصرية).', en: 'To sell it you need stability and preservative-challenge testing and registration with your country’s authority (in Egypt, the Egyptian Drug Authority).' },
};

/** The lessons of the cosmetics expert, in both languages; the Arabic is also studied by the school (src/data/sciences/cosmetics.ts). */
export interface CosmeticLessonText { id: string; title: LText; question: LText; answer: LText; keywords: string[] }
export const COSMETIC_LESSONS: CosmeticLessonText[] = [
  {
    id: 'cos-01', keywords: ['بشرة', 'حاجز الجلد', 'البشرة', 'طبقات الجلد', 'skin barrier'],
    title: { ar: 'تركيب الجلد وحاجزه الواقي', en: 'Skin structure and its barrier' },
    question: { ar: 'الجلد متكوّن من ايه وايه هو حاجز البشرة؟', en: 'What is skin made of, and what is the skin barrier?' },
    answer: { ar: 'الجلد تلات طبقات: البشرة الخارجية، والأدمة تحتها وفيها الكولاجين والإيلاستين والأوعية والغدد الدهنية وبصيلات الشعر، وتحتهم الطبقة الدهنية. أهم جزء في التجميل هو الطبقة القرنية، آخر طبقة في البشرة: خلايا ميتة مرصوصة زي الطوب، وبينها «مونة» من الدهون (سيراميدات وكوليسترول وأحماض دهنية). ده اللي اسمه حاجز البشرة، وشغلته يمنع خروج الماء ودخول المهيجات والميكروبات. لما الحاجز يضعف من الغسيل الزيادة أو المنظفات القوية أو التقشير الكتير، الجلد بيجف ويحمر ويلسع مع أي منتج. عشان كده أي روتين كويس هدفه الأول حماية الحاجز: منظف لطيف، مرطب فيه جاذبات رطوبة ومطريات، وواقي شمس. والبشرة بتجدد نفسها تقريباً كل 4 لـ 6 أسابيع، فأي منتج محتاج وقت قبل الحكم عليه.', en: 'Skin has three layers: the epidermis on top, the dermis below it with collagen, elastin, vessels, oil glands and hair follicles, and the fat layer underneath. The key part for cosmetics is the stratum corneum, the outermost layer: dead cells stacked like bricks with a “mortar” of lipids (ceramides, cholesterol and fatty acids). This is the skin barrier; it keeps water in and irritants and microbes out. When it is weakened by over-washing, harsh cleansers or too much exfoliation, skin turns dry, red and stings with any product. So a good routine first protects the barrier: a gentle cleanser, a moisturiser with humectants and emollients, and sunscreen. Skin renews itself roughly every 4 to 6 weeks, so any product needs time before judging it.' },
  },
  {
    id: 'cos-02', keywords: ['مرطب', 'ترطيب', 'جاذب للرطوبة', 'مطري', 'moisturizer'],
    title: { ar: 'إزاي المرطب بيشتغل', en: 'How a moisturiser works' },
    question: { ar: 'المرطب بيرطب الجلد ازاي وايه الفرق بين الجلسرين والزيوت والشمع؟', en: 'How does a moisturiser hydrate skin, and how do glycerin, oils and waxes differ?' },
    answer: { ar: 'المرطب الكويس بيجمع تلات أنواع من الخامات، كل نوع ليه شغلانة. الأول جاذبات الرطوبة زي الجلسرين وحمض الهيالورونيك والبانثينول واليوريا: بتشد الماء وتمسكه في الطبقة القرنية. التاني المطريات زي الزيوت الخفيفة والسكوالان والجوجوبا: بتملا الفراغات بين خلايا الجلد فيبقى ناعم ومرن. التالت المواد العازلة زي الزبدات والشمع والفازلين: بتعمل طبقة رقيقة فوق الجلد تقلل تبخر الماء. البشرة الدهنية محتاجة جاذبات رطوبة أكتر ومطريات خفيفة، والجافة محتاجة الأنواع التلاتة مع عازل أتقل. وعشان كده الزيت لوحده مش «مرطب» كامل: بيقفل على الجلد لكنه مابيضيفش ماء، وأحسن وقت للزيت أو الكريم على بشرة لسه رطبة بعد الغسيل.', en: 'A good moisturiser combines three kinds of ingredients, each with its job. First, humectants such as glycerin, hyaluronic acid, panthenol and urea draw water in and hold it in the stratum corneum. Second, emollients such as light oils, squalane and jojoba fill the gaps between skin cells so skin feels soft and supple. Third, occlusives such as butters, waxes and petrolatum form a thin film that slows water loss. Oily skin needs more humectants and light emollients; dry skin needs all three with a heavier occlusive. That is why oil alone is not a complete moisturiser: it seals but adds no water, and the best time for oil or cream is on skin still damp after washing.' },
  },
  {
    id: 'cos-03', keywords: ['مستحلب', 'كريم', 'لوشن', 'استحلاب', 'emulsion'],
    title: { ar: 'علم المستحلبات: الكريم واللوشن', en: 'Emulsion science: creams and lotions' },
    question: { ar: 'الكريم بيتعمل ازاي من ماء وزيت مع إنهم مابيختلطوش؟', en: 'How is a cream made from water and oil when they don’t mix?' },
    answer: { ar: 'الكريم واللوشن «مستحلب»: نقط صغيرة جداً من سائل موزعة جوه سائل تاني. الماء والزيت لوحدهم بينفصلوا، فبنحتاج مستحلب: جزيء ليه طرف بيحب الماء وطرف بيحب الزيت، فيقف على سطح كل نقطة ويمنعها تتجمع. أغلب كريمات الوش «زيت في ماء»: الماء هو الأساس فتبقى خفيفة وبتتشرب بسرعة، أما «ماء في زيت» فأتقل ومناسب للجلد الجاف جداً. خطوات الصناعة: نسخن المرحلة المائية والزيتية لحوالي 70–75°م عشان الزبدات والمستحلب يسيحوا، نخلطهم بخلاط قوي فالنقط تصغر، ونقلب وهو بيبرد، وبعد ما ينزل تحت 40°م نضيف الخامات الحساسة للحرارة والحافظة. المكثفات زي الزانثان وكحول السيتيل بتزود الثبات والقوام. ولو الكريم فصل أو طلع ماء بعد أيام، يبقى المستحلب قليل أو الخلط ضعيف أو الحرارة مختلفة بين المرحلتين.', en: 'Creams and lotions are emulsions: tiny droplets of one liquid spread through another. Water and oil separate on their own, so we need an emulsifier: a molecule with a water-loving end and an oil-loving end that sits on each droplet’s surface and stops droplets merging. Most face creams are oil-in-water: water is the base, so they feel light and absorb fast; water-in-oil is heavier and suits very dry skin. To make one, heat the water and oil phases to about 70–75 °C so butters and emulsifier melt, blend them hard so droplets shrink, stir while cooling, and below 40 °C add heat-sensitive ingredients and the preservative. Thickeners such as xanthan and cetyl alcohol add stability and body. If a cream separates or weeps water after a few days, there was too little emulsifier, weak mixing or a temperature gap between the phases.' },
  },
  {
    id: 'cos-04', keywords: ['مادة حافظة', 'حافظة', 'بكتيريا', 'عفن', 'preservative'],
    title: { ar: 'المواد الحافظة وليه هي إجبارية', en: 'Preservatives and why they are mandatory' },
    question: { ar: 'ليه أي كريم فيه ماء لازم يكون فيه مادة حافظة؟', en: 'Why must any cream that contains water have a preservative?' },
    answer: { ar: 'أي منتج فيه ماء أو ماء ورد أو صبار أو جل هو بيئة مثالية للبكتيريا والخمائر والعفن، وبيتلوث من الهوا ومن صوابعنا من أول استخدام. التلوث كتير مابيبانش بالعين لحد ما يبقى خطر، وممكن يسبب التهابات في الجلد أو العين. عشان كده المادة الحافظة واسعة المدى إجبارية في أي تركيبة مائية، بالنسبة المكتوبة من المورد وفي مدى الحموضة اللي بتشتغل فيه. من الأنظمة الشائعة فينوكسي إيثانول مع إيثيل هكسيل جلسرين بحد أقصى 1% في اللائحة الأوروبية، وأنظمة بنزيل ألكوهول مع حمض ديهيدرو أسيتيك. أخطاء منتشرة: فيتامين E مضاد أكسدة بيحمي الزيوت من التزنخ لكنه مش حافظة، ومستخلص بذر الجريب فروت والزيوت العطرية مايكفوش. المنتجات الخالية من الماء زي الزيوت والزبدات والبلسم مش محتاجة حافظة طالما فضلت ناشفة. والشركات بتعمل «اختبار تحدي» بتحقن فيه المنتج بميكروبات وتتأكد إن الحافظة بتقضي عليها.', en: 'Any product with water, rose water, aloe or gel is a perfect home for bacteria, yeast and mould, and is contaminated by air and fingers from the first use. Contamination is often invisible until it is dangerous and can cause skin or eye infections. That is why a broad-spectrum preservative is mandatory in every water-based formula, at the supplier’s level and within its working pH. Common systems are phenoxyethanol with ethylhexylglycerin, capped at 1% in the EU regulation, and benzyl alcohol with dehydroacetic acid. Common mistakes: vitamin E is an antioxidant that protects oils from rancidity but is not a preservative, and grapefruit seed extract or essential oils are not enough. Water-free products such as oils, butters and balms need no preservative as long as they stay dry. Manufacturers run a “challenge test”, inoculating the product with microbes to confirm the preservative kills them.' },
  },
  {
    id: 'cos-05', keywords: ['حموضة', 'ph', 'الأس الهيدروجيني', 'قلوي', 'صابون'],
    title: { ar: 'الحموضة (pH) والبشرة', en: 'pH and the skin' },
    question: { ar: 'يعني ايه pH البشرة وليه حموضة المنتج مهمة؟', en: 'What is skin pH and why does a product’s pH matter?' },
    answer: { ar: 'مقياس الحموضة من 0 لـ 14: أقل من 7 حمضي وأكتر من 7 قلوي. سطح الجلد حمضي خفيف، حوالي 4.5 لـ 5.5، وده اسمه «الغطاء الحمضي» وبيساعد الحاجز والبكتيريا النافعة. الصابون التقليدي قلوي (حوالي 9 لـ 10)، فبيشيل الدهون بقوة وممكن يسيب الجلد مشدود وجاف، وعشان كده غسول الوش اللطيف بيتظبط على 5 لـ 5.5. الحموضة كمان بتحدد شغل الخامات: كل مادة حافظة ليها مدى بتشتغل فيه، وأحماض التقشير زي الجليكوليك بتشتغل في حموضة منخفضة وبتهيج لو زادت قوتها، والنياسيناميد مرتاح بين 5 و7. في التحضير بنقيس بشرائط أو جهاز pH بعد إضافة كل الخامات، ونرفع بقاعدة خفيفة أو ننزل بحمض الستريك نقطة نقطة. منتج ماتعرفش حموضته ماينفعش يتحط على الوش.', en: 'The pH scale runs from 0 to 14: below 7 is acidic and above 7 alkaline. The skin surface is mildly acidic, about 4.5 to 5.5 — the “acid mantle” — which supports the barrier and friendly bacteria. Traditional soap is alkaline (about 9 to 10), so it strips oils hard and can leave skin tight and dry, which is why a gentle face wash is set to 5 to 5.5. pH also decides how ingredients work: every preservative has a working range, exfoliating acids such as glycolic work at low pH and irritate when too strong, and niacinamide is happiest between 5 and 7. When making a product, measure with strips or a pH meter after all ingredients are in, and raise with a mild base or lower with citric acid drop by drop. A product whose pH you don’t know should not go on the face.' },
  },
  {
    id: 'cos-06', keywords: ['مكونات', 'ملصق', 'inci', 'قراءة المكونات', 'ingredients label'],
    title: { ar: 'قراءة قائمة المكونات (INCI)', en: 'Reading the ingredient list (INCI)' },
    question: { ar: 'ازاي اقرا قائمة مكونات الكريم على العلبة؟', en: 'How do I read the ingredient list on a cream?' },
    answer: { ar: 'المكونات مكتوبة بالأسماء الدولية INCI، ودي لغة موحدة في كل الدول، فالماء مكتوب Aqua وزبدة الشيا Butyrospermum Parkii Butter. القاعدة الأساسية: الخامات مرتبة من الأكبر نسبة للأصغر لحد 1%، وبعد كده الخامات اللي أقل من 1% ممكن تتكتب بأي ترتيب. فلو المادة الفعالة اللي المنتج بيتعلن بيها جاية بعد الحافظة أو العطر، غالباً نسبتها أقل من 1%. كلمة Parfum أو Fragrance ممكن تخبي عشرات المواد، واللائحة الأوروبية بتلزم بكتابة مسببات الحساسية المعروفة زي اللينالول والليمونين والجيرانيول لو عدّت حد معين. الألوان بتتكتب بأرقام CI في الآخر. خلي بالك من الكلام التسويقي: «طبيعي» و«خالي من الكيماويات» مالهمش معنى علمي لأن كل حاجة حتى الماء كيمياء، والمهم الخامة نفسها ونسبتها وثبات التركيبة.', en: 'Ingredients are listed by INCI names, a single international language, so water is Aqua and shea butter is Butyrospermum Parkii Butter. The basic rule: ingredients run from the highest level to the lowest down to 1%, and those below 1% may appear in any order. So if the active a product is marketed on comes after the preservative or the fragrance, it is probably below 1%. Parfum or Fragrance can hide dozens of substances, and EU rules require naming known allergens such as linalool, limonene and geraniol above a threshold. Colours appear as CI numbers at the end. Beware of marketing words: “natural” and “chemical-free” have no scientific meaning — everything, water included, is chemistry; what matters is the ingredient, its level and the formula’s stability.' },
  },
  {
    id: 'cos-07', keywords: ['نياسيناميد', 'فيتامين سي', 'ريتينول', 'تقشير', 'actives'],
    title: { ar: 'أشهر المواد الفعالة وحدودها', en: 'Popular actives and their limits' },
    question: { ar: 'ايه الفرق بين النياسيناميد والهيالورونيك وفيتامين سي والريتينول والأحماض؟', en: 'How do niacinamide, hyaluronic acid, vitamin C, retinol and acids differ?' },
    answer: { ar: 'حمض الهيالورونيك جاذب رطوبة بيدي امتلاء ونعومة ومناسب لكل البشرات. النياسيناميد (فيتامين B3) بيساعد على توحيد اللون وتنظيم الدهون وتقوية الحاجز، وأغلب الدراسات على 2 لـ 5%، والأعلى ممكن يحمّر البشرة الحساسة. فيتامين سي (حمض الأسكوربيك) مضاد أكسدة وبيدي نضارة لكنه بيتأكسد بسرعة ويصفر، ومحتاج حموضة منخفضة وعبوة معتمة، فالتركيبات المعملية أضمن من البيت. الريتينويدات زي الريتينول بتسرّع تجدد الخلايا وتحسن الخطوط الرفيعة، لكنها بتهيج في الأول وبتزود حساسية الشمس، وممنوعة في الحمل والرضاعة. أحماض التقشير: الجليكوليك واللاكتيك للسطح والملمس، والساليسيليك بيدخل المسام ومناسب للبشرة الدهنية، وكلها بتزود حساسية الشمس. القاعدة: مادة جديدة واحدة كل مرة، ابدأ بتركيز قليل، واقي شمس يومياً، وماتجمعش الريتينول والأحماض القوية في نفس الليلة.', en: 'Hyaluronic acid is a humectant that plumps and smooths and suits every skin. Niacinamide (vitamin B3) helps even tone, balance oil and strengthen the barrier; most studies use 2 to 5%, and higher can redden sensitive skin. Vitamin C (ascorbic acid) is an antioxidant that brightens but oxidises and yellows quickly, needing low pH and opaque packaging, so lab formulas are safer than home ones. Retinoids such as retinol speed cell turnover and improve fine lines but irritate at first, raise sun sensitivity and are avoided in pregnancy and breastfeeding. Exfoliating acids: glycolic and lactic work on the surface and texture, salicylic enters pores and suits oily skin, and all raise sun sensitivity. The rule: one new active at a time, start low, daily sunscreen, and don’t combine retinol and strong acids on the same night.' },
  },
  {
    id: 'cos-08', keywords: ['واقي شمس', 'spf', 'أشعة فوق بنفسجية', 'حماية من الشمس', 'sunscreen'],
    title: { ar: 'الحماية من الشمس ورقم SPF', en: 'Sun protection and SPF' },
    question: { ar: 'يعني ايه SPF وينفع اعمل واقي شمس في البيت؟', en: 'What does SPF mean, and can I make sunscreen at home?' },
    answer: { ar: 'الشمس فيها نوعين أشعة فوق بنفسجية: UVB بتسبب الحروق، وUVA بتدخل أعمق وبتسبب التصبغات وشيخوخة الجلد، والاتنين بيزودوا خطر سرطان الجلد. رقم SPF بيقيس الحماية من UVB: SPF 30 بيحجب حوالي 97% وSPF 50 حوالي 98%، والحماية من UVA بتتكتب «واسع الطيف» أو PA أو علامة UVA. الرقم ده بيطلع من اختبار معملي على ناس حقيقيين بكمية 2 ميلي جرام لكل سنتيمتر مربع، يعني حوالي معلقة صغيرة للوش والرقبة. عشان كده واقي الشمس ممنوع يتعمل في البيت: خلط أكسيد الزنك أو زيت في كريم مابيدّيش توزيع منتظم ولا رقم حماية معروف، وده بيدي إحساس أمان كاذب. الصح: واقي مسجل SPF 30 أو أكتر واسع الطيف، كل يوم حتى في الغيم، وتجديده كل ساعتين في الشمس أو بعد العرق والسباحة، مع الضل والقبعة.', en: 'Sunlight carries two kinds of ultraviolet: UVB causes burns, and UVA goes deeper and causes pigmentation and skin ageing; both raise skin-cancer risk. SPF measures UVB protection: SPF 30 blocks about 97% and SPF 50 about 98%; UVA protection is labelled “broad spectrum”, PA or a UVA mark. The number comes from lab testing on real people at 2 milligrams per square centimetre — about a teaspoon for face and neck. That is why sunscreen must never be made at home: stirring zinc oxide or an oil into a cream gives neither even coverage nor a known protection factor, only a false sense of safety. The right way: a registered broad-spectrum SPF 30 or higher every day, even when cloudy, reapplied every two hours in the sun or after sweating and swimming, with shade and a hat.' },
  },
  {
    id: 'cos-09', keywords: ['شعر', 'فروة الرأس', 'شامبو', 'بلسم', 'hair'],
    title: { ar: 'علم الشعر وفروة الرأس', en: 'Hair and scalp science' },
    question: { ar: 'الشعرة متكونة من ايه وايه الفرق بين الشامبو والبلسم وزيت الشعر؟', en: 'What is a hair strand made of, and how do shampoo, conditioner and hair oil differ?' },
    answer: { ar: 'الشعرة نفسها خلايا ميتة من بروتين الكيراتين، فمفيش منتج «بيحييها»، لكن بنقدر نحميها ونحسن ملمسها. ليها تلات طبقات: القشرة الخارجية حراشيف متراصة زي القرميد، ولما تبقى مقفولة الشعر بيلمع ومايتشابكش؛ والقشرة الوسطى فيها القوة واللون؛ واللب في النص. الحرارة العالية والصبغة والفرد بيفتحوا الحراشيف فيجي الهيشان والتقصف. الشامبو منظفات بتشيل الدهون والأوساخ من فروة الرأس أساساً، والبلسم فيه مواد كاتيونية موجبة بتلزق على الشعرة المشحونة سالب فتقفل الحراشيف وتنعّم. زيوت زي الأرجان والجوجوبا وجوز الهند بتقلل فقدان البروتين والتقصف لو اتحطت على الأطراف قبل الغسيل، وفروة الرأس الدهنية محتاجة زيت خفيف أو مفيش خالص. تساقط الشعر الكتير أو المفاجئ ليه أسباب زي نقص الحديد والغدة الدرقية والهرمونات، ومكانه طبيب جلدية مش زيت.', en: 'A hair strand is dead cells made of the protein keratin, so no product “revives” it, but we can protect it and improve its feel. It has three layers: the cuticle outside, scales overlapping like roof tiles — closed scales mean shine and no tangles; the cortex, which holds strength and colour; and the medulla in the centre. High heat, dye and straightening lift the scales, causing frizz and split ends. Shampoo is surfactants that clean oil and dirt mainly from the scalp; conditioner holds positively charged ingredients that cling to the negatively charged strand, closing the scales and smoothing it. Oils such as argan, jojoba and coconut reduce protein loss and breakage when applied to the lengths before washing; an oily scalp needs a light oil or none. Heavy or sudden hair fall has causes such as low iron, thyroid problems and hormones, and belongs with a dermatologist, not an oil.' },
  },
  {
    id: 'cos-10', keywords: ['أنواع البشرة', 'بشرة دهنية', 'بشرة جافة', 'روتين', 'skin type'],
    title: { ar: 'أنواع البشرة والروتين الأساسي', en: 'Skin types and a basic routine' },
    question: { ar: 'ازاي اعرف نوع بشرتي وايه الروتين الأساسي المناسب ليها؟', en: 'How do I know my skin type, and what basic routine suits it?' },
    answer: { ar: 'اختبار بسيط: اغسل وشك بغسول لطيف واستنى ساعة من غير أي منتج. لو لمع في كل الوش تبقى دهنية، ولو مشدود ومقشر تبقى جافة، ولو اللمعة في الجبهة والأنف والدقن بس تبقى مختلطة، ولو مرتاح تبقى عادية. الحساسية مش نوع منفصل بالظبط: أي بشرة ممكن تبقى حساسة لو بتحمر وتلسع بسهولة. الروتين الأساسي تلات خطوات: غسول لطيف الصبح وبالليل، مرطب مناسب، وواقي شمس كل صبح. الدهنية: غسول جل ومرطب خفيف وممكن نياسيناميد. الجافة: غسول كريمي ومرطب أغنى فيه زبدة أو سيراميد، ومن غير مية سخنة. المختلطة: مرطب خفيف للكل وتركيز أكتر على الأماكن الجافة. الحساسة: أقل عدد خامات ومن غير عطور، وكل منتج جديد باختبار رقعة. أي إضافة زي السيروم أو التقشير تيجي بعد ما الأساس يثبت، وواحدة واحدة.', en: 'A simple test: wash with a gentle cleanser and wait an hour with no product. Shine all over means oily; tight and flaky means dry; shine only on the forehead, nose and chin means combination; comfortable means normal. Sensitivity is not quite a separate type: any skin can be sensitive if it reddens and stings easily. The basic routine has three steps: a gentle cleanser morning and night, a suitable moisturiser, and sunscreen every morning. Oily: a gel cleanser, a light moisturiser and possibly niacinamide. Dry: a creamy cleanser and a richer moisturiser with butter or ceramides, and no hot water. Combination: a light moisturiser overall with extra care on dry areas. Sensitive: as few ingredients as possible, no fragrance, and a patch test for every new product. Extras such as serums or exfoliants come once the basics are settled, one at a time.' },
  },
  {
    id: 'cos-11', keywords: ['زيوت عطرية', 'تخفيف', 'حساسية عطور', 'سمية ضوئية', 'essential oils'],
    title: { ar: 'الزيوت العطرية في مستحضرات البشرة', en: 'Essential oils in skin products' },
    question: { ar: 'الزيوت العطرية آمنة على البشرة وبنخففها قد ايه؟', en: 'Are essential oils safe on skin, and how much do we dilute them?' },
    answer: { ar: 'الزيوت العطرية مركزات قوية جداً من النبات، و«طبيعي» مش معناه آمن. فيها مواد معروفة بتسبب حساسية زي اللينالول والليمونين والجيرانيول والأوجينول، وبتزيد لما الزيت يتأكسد مع الوقت. عشان كده ماتتحطش صافية على الجلد أبداً، والتخفيف المتعارف عليه في المنتجات اللي بتفضل على الجلد حوالي 0.5% أو أقل للوش و1% للجسم، وأقل من كده للأطفال، ومن غيرها خالص لمرطب الشفايف والبشرة الحساسة. بعض الزيوت الحمضية المعصورة على البارد زي البرغموت والليمون فيها مواد بتعمل «سمية ضوئية»: حروق وتصبغات لو الجلد اتعرض للشمس بعدها. والحوامل والمرضعات والأطفال الصغار يبعدوا عنها إلا باستشارة طبيب. نظام IFRA بيحدد أقصى نسبة لكل مادة عطرية حسب نوع المنتج، وده المرجع اللي الصناعة ماشية عليه. والزيوت العطرية مش مادة حافظة ومابتغنيش عنها.', en: 'Essential oils are very strong plant concentrates, and “natural” does not mean safe. They contain known allergens such as linalool, limonene, geraniol and eugenol, which grow worse as the oil oxidises over time. So they never go on skin neat; the usual dilution in leave-on products is about 0.5% or less for the face and 1% for the body, lower for children, and none at all in lip balm and sensitive-skin products. Some cold-pressed citrus oils such as bergamot and lemon are phototoxic: they cause burns and pigmentation if the skin then meets the sun. Pregnant and breastfeeding women and young children should avoid them unless a doctor agrees. The IFRA system sets a maximum for each fragrance material by product type, and the industry follows it. Essential oils are not preservatives and cannot replace one.' },
  },
  {
    id: 'cos-12', keywords: ['سلامة مستحضرات التجميل', 'مواد ممنوعة', 'تفتيح', 'تسجيل', 'cosmetics law'],
    title: { ar: 'السلامة والقانون والمواد الممنوعة', en: 'Safety, law and banned substances' },
    question: { ar: 'ايه المواد الممنوعة في مستحضرات التجميل وايه المطلوب عشان ابيع منتج؟', en: 'Which substances are banned in cosmetics, and what does it take to sell a product?' },
    answer: { ar: 'مستحضرات التجميل ليها قوانين: في أوروبا اللائحة 1223/2009 بتحدد مئات المواد الممنوعة والمقيدة بنسب معينة، وفي مصر هيئة الدواء المصرية بتسجل المستحضرات وبتراقبها. أخطر حاجة منتشرة كريمات «التفتيح» المغشوشة: بعضها فيه زئبق بيأذي الكلى والأعصاب، أو هيدروكينون عالي من غير إشراف طبي، أو كورتيزون بيرقق الجلد ويعمل حبوب وخطوط. أي كريم بيوعد بتفتيح سريع جداً أو مالوش تسجيل ولا بيانات مصنع، ابعد عنه. عشان تبيع منتج لازم: تركيبة ثابتة بأسماء INCI، اختبار ثبات على حرارات مختلفة، اختبار تحدي للحافظة، تقييم سلامة، ملصق فيه المكونات وتاريخ التشغيلة والصلاحية وبيانات المصنع، وتسجيل عند الجهة المختصة في بلدك. وفي أي تركيبة، حتى للبيت: اختبار رقعة قبل الاستخدام، ماء مقطر، حافظة مع أي ماء، وأدوات معقمة.', en: 'Cosmetics are regulated: in Europe, Regulation 1223/2009 lists hundreds of banned substances and others restricted to set levels, and in Egypt the Egyptian Drug Authority registers and monitors products. The most dangerous common problem is fake “whitening” creams: some contain mercury, which harms the kidneys and nerves, high hydroquinone without medical supervision, or steroids that thin the skin and cause spots and stretch marks. Avoid any cream promising very fast lightening or carrying no registration or maker’s details. To sell a product you need: a stable formula with INCI names, stability testing at several temperatures, a preservative challenge test, a safety assessment, a label with ingredients, batch date, expiry and maker details, and registration with your country’s authority. And in any formula, even at home: a patch test before use, distilled water, a preservative with any water, and sanitised tools.' },
  },
];

export const cosmeticsLoc = (lang: SupportedLanguage, text: LText): string => loc(lang, text);
