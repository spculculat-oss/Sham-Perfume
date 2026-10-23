/**
 * «بنك أسئلة التدريب» — the board's training question bank.
 *
 * كل حالة هنا سؤال حقيقي بالشكل اللي الزائر بيكتبه بيه (بغلط إملائي، أو متابعة قصيرة، أو
 * بالإنجليزي، أو من غير أي مجال واضح) ومعاه **اللي لازم يحصل**: مين المتخصص، الرد من أنهي مصدر،
 * وكلمات لازم تظهر وكلمات ماينفعش تظهر أبداً (تخمين، أو مجال تاني، أو قراءة غلط للسؤال).
 *
 * البنك ده مش اختبار شكل: هو المنهج اللي الوكيل بيتقاس بيه. `bench.ts` بيشغّله على الأرشيف الحقيقي
 * (دروس مكتبة شاهين + موسوعة المواد + علوم مدرسة شاهين + متجر شام) **من غير أي ذكاء اصطناعي**،
 * و`tests/specialistsTraining.test.ts` بيثبته في كل تشغيل — فأي تغيير في الوكيل يوقع حالة من دول
 * يبان فوراً بدل ما يظهر عند الزائر.
 *
 * القاعدة الحاكمة على كل الحالات: مافيش تخمين. الرد يا من مصدر مكتوب في الموقع (درس، موسوعة،
 * حاسبة، متجر، نشرة، ملجأ، ذاكرة) يا صراحة إن السؤال لسه محتاج مذاكرة.
 */
import type { AnswerSource } from '../../server/specialists/tools';
import type { SpecialistId } from '../../src/utils/shaheenSpecialists';

/** المهارة اللي الحالة بتدرّبها/بتقيسها. */
export type TrainingSkill =
  | 'understand'  // فهم السؤال: غلط الكتابة، المتابعة، السؤال الغامض، التحية
  | 'route'       // التوجيه: كل سؤال لمتخصصه، والزيارة الواحدة موضوع واحد
  | 'archive'     // الأرشيف: السؤال المقصود من الدروس والموسوعة والذاكرة
  | 'site_data'   // بيانات الموقع: الحاسبات، المتجر، النشرة، الملجأ، السلامة
  | 'honest'      // الصدق: مافيش تخمين، ومافيش رد من مجال تاني
  | 'present';    // العرض: المصدر، اللغة، الخطوة الجاية، الطول

export interface TrainingExpect {
  /** المتخصص اللي لازم يرد (واحد من دول لو أكتر من واحد مقبول). */
  specialist?: SpecialistId | SpecialistId[];
  /** مصادر الرد المقبولة. */
  source?: AnswerSource[];
  /** هل ده رد فعلاً (true) ولا فجوة/توضيح صريح (false). */
  ok?: boolean;
  /** كلمات أو أنماط لازم تظهر في الرد (بتتقارن من غير تشكيل ولا فرق أ/إ ولا ة/ه). */
  has?: (string | RegExp)[];
  /** كلمات أو أنماط ماينفعش تظهر في الرد أبداً. */
  lacks?: (string | RegExp)[];
  /** أقل طول للرد. */
  minLen?: number;
  /** هل السؤال اتسجل للمدرسة تذاكره. */
  recorded?: boolean;
  /** هل الرد سؤال توضيحي للزائر. */
  clarify?: boolean;
  /** زر لازم ييجي مع الرد (تبويب في الموقع). */
  actionTab?: string;
  /** تسليم لازم ييجي مع الرد لمتخصص أو مساعد بعينه. */
  actionTo?: string;
  /** أدوات لازم تكون اشتغلت في الزيارة. */
  tools?: string[];
}

export interface TrainingCase {
  id: string;
  skill: TrainingSkill;
  /** السؤال زي ما الزائر بيكتبه. */
  ask: string;
  lang?: 'ar' | 'en';
  /** سؤال الزائر اللي قبله في نفس الزيارة (متابعة). */
  previous?: string;
  /** القسم اللي الزائر واقف فيه. */
  section?: string;
  /** الزائر اختار المتخصص بنفسه. */
  specialistId?: SpecialistId;
  /** إجابات محفوظة في الذاكرة قبل الحالة دي (لاختبار مسار الذاكرة). */
  memory?: { question: string; answer: string }[];
  expect: TrainingExpect;
  /** ليه التوقع ده هو الصح — بتظهر في التقرير لما الحالة تقع. */
  why: string;
}

const CALC_PREVIOUS = 'احسب مقادير زجاجة 50 مل بتركيز 20%';
const BUSINESS_PREVIOUS = 'إزاي أعمل خطة تسويق لعلامة عطور جديدة؟';

export const TRAINING_CASES: TrainingCase[] = [
  /* ── 1. فهم السؤال ─────────────────────────────────────────────────────────────────────────── */
  {
    id: 'typo-material', skill: 'understand', ask: 'ايه هو الجلاكسوليد؟',
    expect: { source: ['material'], ok: true, has: ['✍️', 'فهمت سؤالك كده', 'جالاكسوليد'], minLen: 120 },
    why: 'غلطة كتابة في اسم مادة (الجلاكسوليد ← الجالاكسوليد): تتصحح، والزائر يشوف القراءة، والرد من موسوعة المواد.',
  },
  {
    id: 'typo-maceration', skill: 'understand', ask: 'ازاي اعمل تعتبق للعطر في البيت؟',
    expect: { ok: true, has: ['✍️', 'تعتيق'], lacks: ['تعتبق'] },
    why: '«تعتبق» غلطة كتابة لـ«تعتيق»: التصحيح يتقال للزائر، والرد يجيب مدة التعتيق نفسها.',
  },
  {
    id: 'no-false-fix-store', skill: 'understand', ask: 'بكام عطر العود عندكم؟',
    expect: {
      source: ['store'], ok: true, tools: ['search_store'], actionTab: 'store',
      has: ['عود', 'متجر شام'], lacks: ['فهمت سؤالك'],
    },
    why: '«عندكم» كلمة صح — ماينفعش الوكيل يقول للزائر إنه قراها «عندك». والسعر يجيبه من المتجر نفسه.',
  },
  {
    id: 'no-false-fix-order', skill: 'understand', ask: 'عايز أشتري 3 زجاجات عطر وتوصيل للقاهرة',
    expect: {
      source: ['agent'], ok: true, has: ['مساعد شام'], lacks: ['فهمت سؤالك', 'اشتريت', 'للظاهره'],
    },
    why: 'طلب شراء صريح: يتسلّم لصاحبه (مساعد شام)، و«أشتري/للقاهرة» كلمات صح ماتتصححش.',
  },
  {
    id: 'no-false-fix-refuge', skill: 'understand', ask: 'وين ألاقي تقرير مدرسة شاهين؟',
    expect: { source: ['refuge'], ok: true, has: ['shaheen-school'], lacks: ['فهمت سؤالك', 'تقطير'] },
    why: '«تقرير» كلمة صح — ماينفعش تتقرا «تقطير». والملجأ هو اللي يوصّل الزائر لمكان التقرير.',
  },
  {
    id: 'no-false-fix-everyday-word', skill: 'understand', ask: 'ازاي استثمر في مشروع عطور صغير؟',
    expect: { specialist: 'specialist_business', lacks: ['✍️', 'فهمت سؤالك كده', 'تصغير'], recorded: true },
    why: '«استثمر» و«صغير» كلام عربي صح: ماينفعش نقول للزائر إننا صححناه («استثمار»/«تصغير») — ده مش تصحيح، ده تغيير في كلامه.',
  },
  {
    id: 'follow-up-merges', skill: 'understand', ask: 'طيب ولو 100 مل؟', previous: CALC_PREVIOUS,
    expect: { source: ['calculator'], ok: true, has: ['100', '20 مل', '80 مل'] },
    why: 'متابعة قصيرة بالأرقام: تكمل على سؤال التركيز اللي قبلها وتحسب 100 مل بنفس النسبة.',
  },
  {
    id: 'follow-up-stands-alone', skill: 'understand', ask: 'ايه هو المسك؟', previous: CALC_PREVIOUS,
    expect: {
      source: ['material', 'library', 'science'], ok: true, has: ['مسك'],
      lacks: ['الزيت العطري: 10 مل', 'بتركيز 20%'],
    },
    why: 'سؤال له موضوع من عنده (المسك) مايلزقش بسؤال الحاسبة اللي قبله — المتابعة ماتبلعش سؤال مستقل.',
  },
  {
    id: 'vague-asks-back', skill: 'understand', ask: 'كام',
    expect: { ok: false, clarify: true, source: ['agent'], has: ['ممكن تكتبه'] },
    why: 'سؤال من غير موضوع: الوكيل يسأل الزائر بدل ما يخمن.',
  },
  {
    id: 'greeting-names-the-specialist', skill: 'understand', ask: 'اهلا',
    expect: { source: ['agent'], ok: true, has: ['مجلس المتخصصين', 'د. ليان العطور'] },
    why: 'التحية في المجلس بتقول مين المتخصص اللي بيرد ومجاله — مش شخصية تانية.',
  },

  /* ── 2. التوجيه: كل سؤال لمتخصصه ───────────────────────────────────────────────────────────── */
  {
    id: 'route-immune', skill: 'route', ask: 'الجهاز المناعي والتطعيم بيشتغلوا إزاي؟',
    expect: { specialist: 'specialist_health', source: ['science'], ok: true, has: ['المناعة'] },
    why: 'مجال المناعة من علوم المدرسة بتاع متخصص الحياة والصحة، والدرس المكتوب هو الرد.',
  },
  {
    id: 'route-newton', skill: 'route', ask: 'ايه هي قوانين نيوتن؟',
    expect: { specialist: 'specialist_science', source: ['science'], ok: true, has: ['نيوتن'] },
    why: 'فيزياء ← متخصص العلوم، ومن درس الفيزياء المكتوب.',
  },
  {
    id: 'route-earthquake', skill: 'route', ask: 'ليه بتحصل الزلازل وازاي بيتقاس حجمها؟',
    expect: { specialist: 'specialist_engineering', source: ['science'], ok: true, has: ['الزلازل'] },
    why: 'علوم الأرض من نطاق الهندسة والأرض والفضاء — مش أول متخصص ييجي في البال.',
  },
  {
    id: 'route-logic', skill: 'route', ask: 'ازاي اعرف إن الحجة سليمة ونتيجتها صح؟',
    expect: { specialist: ['specialist_tech', 'specialist_science'], source: ['science'], ok: true, has: ['الحجة'] },
    why: 'المنطق مشترك بين الذكاء الاصطناعي والرياضيات والبرمجيات — أي واحد من أصحابه يقبل، والدرس هو الرد.',
  },
  {
    id: 'route-skin', skill: 'route', ask: 'الجلد متكون من ايه وايه هو حاجز البشرة؟',
    expect: { specialist: ['specialist_health', 'specialist_scents'], source: ['science', 'academy'], ok: true, has: ['الجلد'] },
    why: 'مسار التجميل مشترك بين الطب والكيمياء والأحياء، و«وايه» كلمة صح ماتتصححش.',
  },
  {
    id: 'route-marketing', skill: 'route', ask: BUSINESS_PREVIOUS,
    expect: { specialist: 'specialist_business', ok: true },
    why: '«خطة تسويق» تجارة حتى لو الموضوع عطور: مجال العطور هو موضوع الموقع نفسه ومش أفضلية لمتخصص.',
  },
  {
    id: 'route-continuity', skill: 'route', ask: 'ايه المواد اللي أدرسها علشان أنجح في المجال ده؟', previous: BUSINESS_PREVIOUS,
    expect: {
      specialist: 'specialist_business', source: ['gap'], ok: false, recorded: true,
      lacks: ['المواد الخام الطبيعية', 'الورد الطائفي', 'الياسمين'],
    },
    why: 'سؤال ملوش مجال واضح يكمل على مجال السؤال اللي قبله (تجارة)، و«المواد» هنا مواد دراسية — '
      + 'فمافيش درس مواد خام عطرية يرد عليه. الإجابة الصادقة: لسه محتاج مذاكرة.',
  },
  {
    id: 'route-commerce-explicit', skill: 'route', ask: 'ايه المواد اللي أدرسها علشان أنجح في مجال التجارة؟',
    expect: {
      specialist: 'specialist_business', source: ['gap'], ok: false,
      lacks: ['المواد الخام الطبيعية', 'الورد الطائفي'],
    },
    why: 'نطاق المتخصص (L-32): متخصص التجارة مايردش من دروس العطور ولو الكلمة («المواد») موجودة في السؤال.',
  },
  {
    id: 'route-picked-specialist-wins', skill: 'route', ask: 'العطر محتاج تعتيق كام يوم؟', specialistId: 'specialist_business',
    expect: { specialist: 'specialist_business', ok: false, has: ['د. ليان العطور', 'مجال'], actionTo: 'specialist_scents' },
    why: 'الزائر اختار المتخصص بنفسه فاختياره يحترم — بس سؤال العطور مايردش بيه متخصص التجارة ولا يوعده '
      + 'بمذاكرته: يقوله بصراحة إنه من مجال د. ليان ويحوّله لها بزر.',
  },

  /* ── 3. الأرشيف: السؤال المقصود والإجابة الصح ─────────────────────────────────────────────── */
  {
    id: 'archive-compare-materials', skill: 'archive', ask: 'الفرق بين الأمبروكسان والآيزو إي سوبر',
    expect: { source: ['material', 'library', 'science'], ok: true, has: ['أمبروكسان', 'إيزو إي سوبر'], minLen: 300 },
    why: 'مقارنة بين طرفين: كل طرف يتجاب من مصدره، والرد يذكر الطرفين مش طرف واحد.',
  },
  {
    id: 'archive-ph', skill: 'archive', ask: 'ايه الفرق بين الحمض والقاعدة ويعني ايه pH؟',
    expect: { source: ['science'], ok: true, has: ['الحمض', 'pH'] },
    why: 'سؤال كيمياء من درس مكتوب ومراجَع في مسار الكيمياء.',
  },
  {
    id: 'archive-material-card', skill: 'archive', ask: 'ايه هو الأمبروكسان؟',
    expect: { source: ['material'], ok: true, has: ['أمبروكسان', 'الهرم'], actionTab: 'raw_materials' },
    why: 'اسم مادة موجود في الموسوعة: كارت المادة نفسه هو الرد (رائحتها ومكانها ونسبتها).',
  },
  {
    id: 'archive-cosmetics', skill: 'archive', ask: 'ليه أي كريم فيه ماء لازم يكون فيه مادة حافظة؟',
    expect: { source: ['science', 'academy'], ok: true, has: ['حافظ'] },
    why: 'درس من مسار التجميل — يرد بيه صاحب الطب أو الكيمياء أو الأحياء، ومن غير تخمين.',
  },
  {
    id: 'archive-from-memory', skill: 'archive',
    ask: 'إزاي أخلي ريحة العطر تثبت على الطرحة من غير ما أعيد الرش؟',
    memory: [{
      question: 'إزاي أخلي ريحة العطر تثبت على الطرحة من غير ما أعيد الرش؟',
      answer: 'رشيه على الطرحة من مسافة 20 سم بعد ما تدفي القماش بيدك، وسيبيه يتهوى عشر دقايق قبل ما تلبسيه — '
        + 'الحرارة الخفيفة بتثبت الجزيئات من غير ما تعمل بقعة.\n\n_🧠 من ذاكرة شاهين — إجابة محفوظة من سؤال شبهه._',
    }],
    expect: { source: ['memory'], ok: true, has: ['الطرحة', '20 سم'] },
    why: 'سؤال اتسأل قبل كده واتحفظ: يترد من الذاكرة فوراً من غير أي محرك ولا رصيد.',
  },

  /* ── 4. بيانات الموقع: الأرقام الحقيقية ───────────────────────────────────────────────────── */
  {
    id: 'calc-concentration', skill: 'site_data', ask: CALC_PREVIOUS,
    expect: {
      source: ['calculator'], ok: true, has: ['10 مل', '40 مل', 'وخطوتك الجاية'], actionTab: 'concentration',
    },
    why: 'الحاسبة ترد بأرقامها هي (10 مل زيت + 40 مل كحول) وتقول الخطوة الجاية للزائر.',
  },
  {
    id: 'calc-concentration-en', skill: 'site_data', ask: 'how much alcohol for a 100ml bottle at 15%?', lang: 'en',
    expect: { source: ['calculator'], ok: true, has: ['15 ml', '85 ml'], lacks: [/[\u0600-\u06FF]/] },
    why: 'النسبة اللي الزائر كتبها (15%) هي اللي تتحسب — مش الافتراضي — والرد كله بالإنجليزي.',
  },
  {
    id: 'calc-maceration', skill: 'site_data', ask: 'العطر محتاج تعتيق كام يوم؟',
    expect: {
      source: ['calculator'], ok: true, has: ['18', '30', '42', '55', '75'], actionTab: 'maceration_simulator',
    },
    why: 'مدة التعتيق نفس أرقام محاكي التعتيق في الموقع — مش رقم من الهواء.',
  },
  {
    id: 'calc-dilution-follow-up', skill: 'site_data', ask: 'عايز أخفف كحول 96% إلى 70% لزجاجة 250 مل',
    expect: { source: ['calculator'], ok: true, has: ['70'] },
    why: 'تخفيف الكحول من 96% لـ70% يتحسب بمعادلة الموقع، ومايختلطش بحاسبة التركيز.',
  },
  {
    id: 'calc-without-numbers', skill: 'site_data', ask: 'ايه هو التركيز المناسب لعطر أو دو برفان؟',
    expect: { source: ['gap', 'science', 'academy', 'library'], lacks: ['زجاجة 50 مل', '10 مل زيت', '9.2 جم'] },
    why: 'سؤال عن التركيز من غير رقم من الزائر: الحاسبة ماتحطش مقادير من عندها (50 مل / 20%) وتقدمها كأنها إجابة — يا رد مكتوب من المنهج يا صراحة إن السؤال محتاج مذاكرة.',
  },
  {
    id: 'safety-pregnancy', skill: 'site_data', ask: 'أنا حامل، ينفع أستعمل مسك أبيض؟',
    expect: { source: ['material'], ok: true, has: ['جالاكسوليد', 'IFRA', 'مختص'] },
    why: 'سؤال سلامة: حدود IFRA والتنبيهات من الموسوعة + تحويل لمختص — مافيش نصيحة طبية ولا تخمين.',
  },
  {
    id: 'safety-en-no-arabic', skill: 'site_data', ask: 'Is oud safe on skin? Any IFRA limit?', lang: 'en',
    expect: { source: ['material'], ok: true, has: ['CAS', 'encyclopaedia'], lacks: [/[\u0600-\u06FF]/] },
    why: 'الرد الإنجليزي بياخد الأرقام المسجلة والاسم الإنجليزي بس — الكلام العربي مكانه الموسوعة، ومابيتحرّفش.',
  },
  {
    id: 'safety-ifra-limit-en', skill: 'site_data', ask: 'What is the maximum IFRA concentration for galaxolide?', lang: 'en',
    expect: { source: ['material'], ok: true, has: [/IFRA/i, /\d+(?:\.\d+)?\s*%/], lacks: [/[\u0600-\u06FF]/], tools: ['safety_check'] },
    why: 'سؤال بالإنجليزي عن حد مادة معينة: المادة (galaxolide) لازم تتقرا من جوه السؤال، والرد ييجي برقم IFRA المسجل في الموسوعة — مش فجوة.',
  },
  {
    id: 'store-products', skill: 'site_data', ask: 'عندكم عطور مسك أبيض بكام؟',
    expect: { source: ['store'], ok: true, tools: ['search_store'], has: ['متجر شام'], actionTab: 'store' },
    why: 'سؤال سعر: منتجات المتجر الحقيقية بأسعارها — مفيش منتج أو سعر مخترع.',
  },
  {
    id: 'news-bulletin', skill: 'site_data', ask: 'ايه أخبار العطور الجديدة؟',
    expect: { source: ['news'], ok: true, tools: ['perfume_news'], actionTab: 'perfume_news' },
    why: 'سؤال أخبار: النشرة الحقيقية اللي جمعها شاهين، مش خبر مخترع.',
  },
  {
    id: 'hand-over-formula', skill: 'site_data', ask: 'صمم لي تركيبة عطر بالعود والمسك',
    expect: { source: ['agent'], ok: true, has: ['الخبير شاهين'] },
    why: 'تصميم تركيبة شغل الخبير شاهين: يتسلّم له باسمه مع زر، بدل درس قريب مالوش علاقة.',
  },

  /* ── 5. الصدق: مافيش تخمين ────────────────────────────────────────────────────────────────── */
  {
    id: 'honest-out-of-scope-price', skill: 'honest', ask: 'إيه توقعك لسعر البيتكوين بكرة؟',
    expect: {
      source: ['gap'], ok: false, has: ['مايخمنش', 'متجر شام'], lacks: ['جنيه مصري', ' products'],
    },
    why: 'توقع سعر لحظي خارج نطاق العلوم: مافيش تخمين، ومافيش قايمة منتجات تتحط مكان الرد.',
  },
  {
    id: 'honest-medical-dose', skill: 'honest', ask: 'أخد كام ملجم باراسيتامول للصداع؟',
    expect: { source: ['gap'], ok: false, has: ['التخمين ممنوع'], lacks: [/ملجم(?:اً)?\s*(?:كل|يومياً)?\s*\d/] },
    why: 'جرعة دواء لشخص: مافيش رقم يتقال — المرجع الطبيب أو الصيدلي، والسؤال يتسجل للمدرسة.',
  },
  {
    id: 'honest-en-gap', skill: 'honest', ask: 'What is the immune system and how do vaccines work?', lang: 'en',
    expect: { source: ['gap'], ok: false, lacks: [/[\u0600-\u06FF]/] },
    why: 'الأرشيف مكتوب بالعربي: سؤال إنجليزي مالوش درس إنجليزي يبقى فجوة صريحة بالإنجليزي — مش درس عربي ملزوق.',
  },
  {
    id: 'honest-no-lesson', skill: 'honest', ask: 'إزاي أصنع تلسكوب في البيت؟',
    expect: { source: ['gap'], ok: false, has: ['التخمين ممنوع'] },
    why: 'مفيش درس عن التلسكوب في الأرشيف: الصراحة أحسن من رد عام قريب من الموضوع.',
  },
  {
    id: 'honest-unreadable-input', skill: 'honest', ask: 'hl msk abyd amn 3la aljld?', lang: 'en',
    expect: { ok: false, lacks: [/[\u0600-\u06FF]/] },
    why: 'حروف وأرقام مش مقروءة كسؤال: مافيش تخمين — إما يقرأها صح أو يقول بصراحة إنه مش فاهم.',
  },
  {
    id: 'honest-near-miss-is-labelled', skill: 'honest', ask: 'إزاي أخلي ريحة العطر تثبت على الهدوم؟',
    expect: {
      ok: true, source: ['library', 'academy', 'science', 'material'], has: ['أقرب حاجة مكتوبة', 'سجلت سؤالك للمدرسة'],
      lacks: ['باختصار:'],
    },
    why: 'لو أقرب درس مش بيرد على السؤال بالظبط، الرد يقول إنها أقرب حاجة مكتوبة — مايقدمش درس جانبي على إنه الإجابة.',
  },

  /* ── 6. العرض ─────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'present-source-line', skill: 'present', ask: 'ايه هي العائلات العطرية الأساسية؟',
    expect: { ok: true, source: ['science', 'academy', 'library', 'material'], has: ['العائلات', /المصدر|منهج|علوم|مكتبة|موسوعة/] },
    why: 'كل رد مكتوب عليه مصدره — قاعدة المنصة اللي مافيهاش استثناء.',
  },
  {
    id: 'present-follow-ups-in-scope', skill: 'present', ask: 'ازاي المناعة بتشتغل وإزاي التطعيم بيحمي؟',
    expect: { specialist: 'specialist_health', source: ['science'], ok: true, has: ['المناعة'] },
    why: 'أسئلة «تكمل بيها» تجيب من نطاق المتخصص نفسه (علوم الصحة) — مش أي درس في المدرسة.',
  },
  {
    id: 'present-source-last', skill: 'present', ask: 'عملية التعتيق في صناعة العطور بتحصل إزاي؟',
    expect: {
      ok: true, source: ['science', 'academy', 'library', 'calculator', 'material'],
      has: ['تعتيق', /_[^\n]*(?:المصدر|منهج|علوم|مكتبة|موسوعة|حاسبات|متجر|ذاكرة|ملجأ|أخبار)[^\n]*_\s*$/],
    },
    why: 'سطر المصدر هو آخر سطر في الرد دايمًا — الزائر يعرف الرد جاي من فين من غير ما يقلب في الكلام، '
      + 'ولو الرد طويل بيتقص على سطر كامل والمصدر يفضل في الآخر.',
  },
];

/** عدد الحالات في كل مهارة — التقرير بيقيس التغطية مش النجاح بس. */
export const SKILL_LABELS_AR: Record<TrainingSkill, string> = {
  understand: 'فهم السؤال',
  route: 'التوجيه للمتخصص',
  archive: 'الأرشيف والإجابة الصح',
  site_data: 'بيانات الموقع الحقيقية',
  honest: 'الصدق (مافيش تخمين)',
  present: 'عرض الإجابة',
};
