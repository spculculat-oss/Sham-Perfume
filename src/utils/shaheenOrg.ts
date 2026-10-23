/**
 * «الهيكل الإداري لمنصة شام» — every robot (GitHub Actions workflow) and every AI tool on the site, under
 * the umbrella of «الخبير شاهين», all under «دولة المنصة» (src/utils/platformState.ts — the highest authority over the
 * robots, right under the site owner, deciding every approval by its members' vote). Shaheen is the general manager; his secretary («مشرف شاهين») deputises for
 * him when there is no AI engine or the load is high; five departments (cells), each headed by a seat of
 * the daily meeting, hold the bots. LINKS says who helps whom (the cooperation map).
 *
 * Pure data (browser-safe): the admin panel draws the map from it, the pre-meeting check
 * (scripts/shaheen-council/precheck.ts) checks every bot listed here, and tests/shaheenOrg.test.ts fails when
 * a workflow or an AI tool is not placed under Shaheen — so no new robot runs outside the structure.
 */
import { AI_TOOLS, type AiToolId } from './aiTools';

export type DeptId = 'leadership' | 'store' | 'content' | 'experience' | 'reliability' | 'innovation';

export interface Department {
  id: DeptId;
  nameAr: string;
  nameEn: string;
  /** The meeting seat that heads the department (scripts/shaheen-council/council.ts SEATS). */
  seat: 'manager' | 'store' | 'content' | 'experience' | 'reliability';
  headAr: string;
  headEn: string;
  missionAr: string;
}

export const DEPARTMENTS: Department[] = [
  { id: 'leadership', nameAr: 'القيادة', nameEn: 'Leadership', seat: 'manager', headAr: 'الخبير شاهين — المدير العام', headEn: 'Master Shaheen — general manager', missionAr: 'يدير كل الأدوات، يرأس الاجتماع اليومي، يحدد أهداف التطوير ويوزع المهام.' },
  { id: 'store', nameAr: 'قسم المتجر والاستيراد', nameEn: 'Store & import', seat: 'store', headAr: 'خبير المتجر والاستيراد', headEn: 'Store & import expert', missionAr: 'متاجر موثوقة من العالم، منتجات كاملة بصور نظيفة وأسعار صحيحة (+50% + الشحن)، وصفحات منتجات سليمة.' },
  { id: 'content', nameAr: 'قسم المحتوى والظهور في البحث', nameEn: 'Content & search', seat: 'content', headAr: 'خبير المحتوى والظهور في البحث', headEn: 'Content & search expert', missionAr: 'أخبار حقيقية، دروس، أوصاف قوية، وظهور الموقع في محركات البحث.' },
  { id: 'experience', nameAr: 'قسم تجربة الزائر والتصميم واللغات', nameEn: 'Visitor experience, design & languages', seat: 'experience', headAr: 'خبير تجربة الزائر والتصميم واللغات', headEn: 'Visitor experience, design & languages expert', missionAr: 'ما يراه الزائر: الشات، اللغات المئة، الأرقام، التصميم على الموبايل.' },
  { id: 'reliability', nameAr: 'قسم الجودة والاعتماد على النفس', nameEn: 'Reliability & self-reliance', seat: 'reliability', headAr: 'خبير الجودة والاعتماد على النفس', headEn: 'Reliability & self-reliance expert', missionAr: 'كل روبوت شغال، الموقع منشور وسليم، ومدرسة شاهين تخليه يرد لوحده لو كل الخدمات وقفت.' },
  { id: 'innovation', nameAr: 'قسم المعمل: التجارب والابتكار', nameEn: 'Lab: experiments & innovation', seat: 'manager', headAr: 'العالِم المُجرِّب — رئيس معمل شاهين', headEn: 'The Experimenter — lab lead', missionAr: 'معمل شاهين للتجارب والابتكار: فرضيات تُختبر بمتغيرات وضوابط، ونتائج تُوثَّق صادقة، وأبحاث راسخة تُقرأ وتُدرَّس، وتعاون بين العلوم يُجرَّب، ومنتجات تخدم السوق والعلم.' },
];

export type BotId =
  | 'council' | 'secretary' | 'precheck' | 'patrol' | 'maneuver' | 'finance' | 'legal'
  | 'contracts'
  | 'scout' | 'importer' | 'images' | 'catalog' | 'product_pages' | 'store_advisor'
  | 'news' | 'seo' | 'librarian' | 'teacher' | 'researcher'
  | 'chat' | 'library' | 'specialists_board' | 'languages' | 'design_audit' | 'design_expert' | 'visitor_tour' | 'inspect'
  | 'school' | 'doctor' | 'verifier' | 'live_check' | 'keys' | 'intake' | 'studio_bridge' | 'studio_zip' | 'deploy' | 'admin_agent'
  | 'chat_agent' | 'owner_desk' | 'state' | 'academy' | 'platform_owner'
  | 'specialist_scents' | 'specialist_tech' | 'specialist_security' | 'specialist_science' | 'specialist_business' | 'specialist_society'
  | 'specialist_health' | 'specialist_engineering' | 'specialist_learning' | 'specialist_culture' | 'lab';

export interface Bot {
  id: BotId;
  nameAr: string;
  nameEn: string;
  dept: DeptId;
  /** The robot's workflow (.github/workflows/<file>); several bots may share one. */
  workflow?: string;
  /** Its own report (src/data/live/<file>), read by the pre-meeting check. */
  report?: string;
  /** How often it should run (hours): a report older than twice this is late. Absent = on demand. */
  everyHours?: number;
  /** When several bots share one report: the bot's own part of it (report[section], dated by its `at`). */
  section?: string;
  /** The AI tools this bot is (AI_TOOLS ids). */
  aiTools?: AiToolId[];
  dutiesAr: string;
}

export const BOTS: Bot[] = [
  { id: 'librarian', nameAr: 'أمين مكتبة العطور', nameEn: 'Perfume librarian', dept: 'content', dutiesAr: 'ينظم خطط التأليف المستقل وسجلات الأدلة؛ الاعتماد العلمي والقانوني واعتماد شاهين مطلوبون لكل نسخة قبل النشر. مساعد محلي عند الطلب لفهرسة مراجع العطور وتصنيفها والبحث فيها وتصدير بياناتها. موضعه مبدئي تحت إشراف شاهين؛ لا يرفع كتباً محمية ولا يدّعي وجود نسخ أو ترجمات دون ترخيص.' },
  // ── Leadership ──
  { id: 'state', nameAr: 'دولة المنصة (أعلى سلطة بعد صاحب الموقع)', nameEn: 'The Platform State (highest authority under the owner)', dept: 'leadership', workflow: 'platform-state.yml', report: 'platform-state.json', everyHours: 24, dutiesAr: 'كل الروبوتات وشاهين والمجلس تحت رقابتها، وبيرجعولها في كل الموافقات: كل ساعة أعضاؤها (شاهين، المدير القانوني، الأمن والخصوصية، الجودة، المالية، ورئيس القسم المختص) بيصوّتوا على مهام المجلس وتعديلات الروبوتات المستنية موافقة. القرار لا مركزي بالتصويت، وللقانوني والأمن «فيتو»؛ اللي يتوافق عليه بيعدّي كل الفحوص وبعدين ينزل، واللي يترفض بيروح لصاحب الموقع بالأسباب. عندها كل الصلاحيات ما عدا بيانات صاحب الموقع ومفاتيحه وغرفته ومفاتيح تحكمه، وخاضعة لأوامره في أي وقت (يرجّع الموافقات لنفسه، يوقفها، أو يرجّع أي قرار ليها).' },
  { id: 'owner_desk', nameAr: 'مكتب صاحب الموقع (أوامره فوق الكل)', nameEn: "Owner's desk (his orders come first)", dept: 'leadership', workflow: 'owner-control.yml', aiTools: ['owner_room'], dutiesAr: 'ينفذ أوامر صاحب الموقع وحده (حسابه على GitHub بس): يوقف أي روبوت أو يرجعه، يوقف كل الروبوتات بفرامل الطوارئ، ويختار نظام التطوير الذاتي (التصليحات الصغيرة الآمنة تلقائي، أو كل تغيير يستنى موافقته). كل روبوت بيسأل المكتب قبل ما يشتغل، وكل أمر بيتسجل في سجل مايتمسحش. ومعاه «جناح صاحب الموقع» و«غرفة شاهين الخاصة» (صاحب الموقع وشاهين والسكرتير بس، متشفرة على جهازه). وبينفذ كل اللي صاحب الموقع يوافق عليه من «صندوق الموافقات» (تعديلات شاهين، أوامره للروبوتات، تعديلات الروبوتات ومهام المجلس) بعد ما يعدّي كل الفحوص، ويرجّع أي حاجة بزرار «رجّع».' },
  { id: 'platform_owner', nameAr: 'وكيل ملك المنصة', nameEn: 'Platform Owner Agent', dept: 'leadership', aiTools: ['platform_owner_agent'], dutiesAr: 'وكيل مثل وكيل البرمجة في الشات: ينفّذ مهام شاهين والصيانة والتطوير، ويدير المنصة نيابة عن صاحب الموقع تحت رقابة دولة المنصة، وكل تعديل له يقرّه تصويت الدولة قبل النزول، وهو خاضع لأوامر صاحب الموقع في أي وقت.' },
  { id: 'council', nameAr: 'مجلس شاهين (الاجتماع اليومي)', nameEn: "Shaheen's council (daily meeting)", dept: 'leadership', workflow: 'shaheen-council.yml', report: 'shaheen-council.json', everyHours: 24, aiTools: ['shaheen_council'], dutiesAr: 'يجمع رؤساء الأقسام كل يوم 10:15 الصبح (بعد تجديد باقة الذكاء الاصطناعي)، يكتب المحضر، ينفذ الآمن ويحوّل الباقي لمهام تطوير.' },
  { id: 'secretary', nameAr: 'السكرتير — مشرف شاهين', nameEn: 'Secretary — Shaheen\'s supervisor', dept: 'leadership', workflow: 'shaheen-news.yml', report: 'ai-supervisor.json', everyHours: 12, dutiesAr: 'يقيس كل أداة ذكاء اصطناعي ويكتب لها توجيهات، يجهز جدول الأعمال، وينوب عن شاهين في الاجتماع وقت الضغط أو لو مفيش محرك ذكاء اصطناعي.' },
  { id: 'precheck', nameAr: 'الفحص الشامل قبل الاجتماع', nameEn: 'Pre-meeting full check', dept: 'leadership', workflow: 'shaheen-precheck.yml', report: 'shaheen-precheck.json', everyHours: 24, dutiesAr: 'قبل الاجتماع بساعتين: كل روبوت يفحص نفسه ويكتب مشاكله والإصلاح المقترح وأفكار التطوير، والسكرتير يوزع طلبات المساعدة بين الأدوات.' },
  { id: 'patrol', nameAr: 'الدورية بالتناوب (فحص وإصلاح ومراجعة خبير)', nameEn: 'Rotating patrol (check, fix, expert review)', dept: 'leadership', workflow: 'shaheen-patrol.yml', report: 'shaheen-patrol.json', everyHours: 2, dutiesAr: 'تلات ورديات بالتناوب، وردية كل ساعة. الدورية تراجع تقارير وحالة كل دور حسب ورديته، وتجري الاختبارات العملية المحددة لنطاقه كل 3 ساعات من غير ضغط على الموقع. الأدوار الاستشارية اللي مالهاش سير عمل تراقَب من التقارير وتقييم مشرف شاهين ومش بتتشغل تلقائياً. الإصلاحات الآمنة تتعمل، والباقي يروح لشاهين أو لفريق عمل، وكل تشغيل مكتمل يراجعه خبير من نفس النطاق.' },
  { id: 'maneuver', nameAr: 'مناورة التخصصات (فحص ميداني للموقع الحي)', nameEn: 'Specialties field maneuver (live-site field check)', dept: 'leadership', workflow: 'shaheen-maneuver.yml', report: 'shaheen-maneuver.json', everyHours: 6, dutiesAr: 'كل 6 ساعات بيفتح كل أقسام الموقع الحي زي زائر على الموبايل ويتكلم مع شاهين محادثات حقيقية، وكل قسم يفحصه متخصصه: يرصد كل الأخطاء ويقترح التحسينات الناقصة، ويبعت الكل لدولة المنصة اللي بتحدد كل واحدة تحت أنهي قطاع وأنهي روبوت، والخطير يتحول لمهمة.' },
  { id: 'finance', nameAr: 'أمين شاهين — الإدارة المالية', nameEn: 'Shaheen Finance', dept: 'leadership', workflow: 'shaheen-finance.yml', report: 'ai-supervisor.json', everyHours: 24, aiTools: ['finance_agent'], dutiesAr: 'تحصيل موثّق وتقارير يومية وأسبوعية وشهرية ومراجعة الدفع. التفاصيل داخل لوحة مالية خاصة؛ التقرير العام يحتوي حالة الفحص المنقحة من المشرف فقط. لا تحويلات أو استردادات أو اعتماد حسابات تلقائياً.' },
  { id: 'legal', nameAr: 'المدير القانوني', nameEn: 'Legal manager', dept: 'leadership', dutiesAr: 'يراجع امتثال المنصة للقوانين؛ قراراته ملزمة لشاهين وكل الأدوات، ومحدش يتجاوزها لحد ما المدير القانوني نفسه يغيرها (مثال: وقف نقل المنتجات لحد إذن المورد المكتوب).' },
  { id: 'contracts', nameAr: 'مسؤول التعاقدات', nameEn: 'Contracts officer', dept: 'leadership', aiTools: ['contracts_agent'], dutiesAr: 'يجهز رسائل التعاون مع أصحاب المتاجر (يبعتها عضو من الفريق باسمه الحقيقي)، ويدير الموافقة الإلكترونية على الاتفاقية، ومايفتحش متجر للنقل غير بعد توقيعه واعتماد المدير القانوني (L-40). الهامش مايتكشفش، ورابط المتجر بعد الموافقة بس.' },
  // ── Store & import ──
  { id: 'scout', nameAr: 'كشّاف المصادر', nameEn: 'Source scout', dept: 'store', workflow: 'shaheen-discover.yml', report: 'import-sources.json', everyHours: 6, dutiesAr: 'يدوّر على متاجر عطور موثوقة في العالم كله ويراجع سيرتها الذاتية قبل ما تدخل.' },
  { id: 'importer', nameAr: 'مستورد شاهين + مراجع الصفحات', nameEn: 'Shaheen importer + page reviewer', dept: 'store', workflow: 'shaheen-import.yml', report: 'store-review.json', everyHours: 2, aiTools: ['store_import'], dutiesAr: 'ينقل منتجات المتاجر المقبولة ويسعّرها ويراجع كل صفحة ويخفي المعيب.' },
  { id: 'images', nameAr: 'منظف الصور', nameEn: 'Photo cleaner', dept: 'store', workflow: 'shaheen-import.yml', report: 'image-clean.json', everyHours: 2, dutiesAr: 'يشيل أرقام وروابط المورد من صور المنتجات.' },
  { id: 'catalog', nameAr: 'مدرّب كتالوج المتجر', nameEn: 'Store catalog trainer', dept: 'store', workflow: 'shaheen-news.yml', report: 'store-catalog.json', everyHours: 12, aiTools: ['store_catalog'], dutiesAr: 'يصحح الأسماء والأوصاف ويضيف العائلة العطرية والنوتات والمواسم.' },
  { id: 'product_pages', nameAr: 'فاحص صفحات المنتجات على الموبايل', nameEn: 'Product pages check (phone)', dept: 'store', workflow: 'product-pages-check.yml', everyHours: 24, dutiesAr: 'يفتح صفحات المنتجات على الموقع الحقيقي زي زائر على الموبايل ويتأكد إنها سليمة.' },
  { id: 'store_advisor', nameAr: 'مستشار التسوق «اسأل شاهين»', nameEn: 'Shopping advisor', dept: 'store', aiTools: ['store_advisor'], dutiesAr: 'يختار للزائر من منتجات المتجر الحقيقية حسب طلبه.' },
  // ── Content & search ──
  { id: 'news', nameAr: 'نشرة الأخبار ودروس المساعد', nameEn: 'News bulletin & assistant lessons', dept: 'content', workflow: 'shaheen-news.yml', report: 'shaheen-news.json', everyHours: 12, aiTools: ['news_bulletin', 'assistant_training', 'news_articles'], dutiesAr: 'أخبار العطور الحقيقية كل 12 ساعة، ودروس لمساعد شام عن الأسئلة اللي مالقاش لها إجابة.' },
  { id: 'seo', nameAr: 'منارة شاهين (الظهور في البحث)', nameEn: 'Manaret Shaheen (search)', dept: 'content', workflow: 'shaheen-seo.yml', report: 'seo-agent.json', everyHours: 6, aiTools: ['seo_agent'], dutiesAr: 'يفحص الموقع زي محركات البحث، يكتب العناوين والأوصاف ويرسل الصفحات للفهرسة.' },
  { id: 'teacher', nameAr: 'المعلم المحلي ومراجع الدروس', nameEn: 'Local teacher & lesson reviewer', dept: 'content', workflow: 'shaheen-discover.yml', report: 'shaheen-school.json', everyHours: 6, dutiesAr: 'نموذج ذكاء اصطناعي مفتوح (Qwen2.5-7B، رخصة Apache-2.0) شغال على GitHub نفسه من غير مفتاح ولا حساب: يكتب لمدرسة شاهين دروس الأسئلة الناقصة من مراجع المكتبة والمصادر المفتوحة، ومراجع صارم يرفض أي درس فيه معلومة غلط أو نصيحة مش آمنة قبل ما يتحفظ.' },
  { id: 'researcher', nameAr: 'باحث شاهين (المصادر المفتوحة)', nameEn: 'Shaheen researcher (open sources)', dept: 'content', dutiesAr: 'منظومة بحث عنكبوتية موجهة عند الطلب: بحث متوازي، ذاكرة مؤقتة للمستندات العامة لمدة ربع ساعة، دمج الطلبات المتكررة وحدود للتزامن والحجم؛ لا زحف شامل ولا حفظ لأسئلة الزوار. سؤال جديد مش في الذاكرة ولا المكتبة: يدور في ويكيبيديا من الواجهة الرسمية المجانية، يقرا المقالات ويقارنها ويرد بالخلاصة والمصادر (CC BY-SA)، ويدي المدرسة نفس الخلاصة كمراجع. مايبحثش عن الأخبار والأسعار والأسئلة الشخصية، ومايقراش صفحات نتائج جوجل.' },
  // ── Visitor experience, design & languages ──
  { id: 'chat', nameAr: 'شات الخبير شاهين ومساعد شام', nameEn: 'Shaheen chat & Sham assistant', dept: 'experience', aiTools: ['shaheen_chat', 'sham_assistant', 'media'], dutiesAr: 'يرد على الزوار بـ«وكيل شاهين» المربوط بيه مباشرة تحت نظر دولة المنصة (S-10): يقرا السؤال مع الكلام اللي قبله، وسؤال الشراء بيرد عليه من منتجات المتجر نفسها (السعر والحجم والمكونات وليه كل واحد مناسب والربط بينهم)، والتركيبة اللي يصممها بيقترح جنبها عطور المتجر القريبة منها؛ وبيفهم السؤال ومجاله ونوعه الأول، ويختار خبير المدرسة المناسب، ويقارن بين دروس الخبراء المراجَعة والمكتبة والإجابات المحفوظة والمصادر المفتوحة ويختار الأصح (الإجابة القديمة مصدر من المصادر مش الإجابة تلقائياً)، ولو مفيش معلومة أكيدة مايخمّنش ويبعت السؤال لخبير المجال في المدرسة يذاكره. وبيتعامل مع الناس بعلم الاجتماع والعلاقات العامة والتجارة: الشكوى (تأخير، منتج تالف أو غلط، شك في الريحة، استرجاع) يسمعها ويعتذر ويحلها بالخطوات الحقيقية من غير لوم ولا جدال ولا وعد مش أكيد، والزبون الغضبان يرد عليه بهدوء، وطلبات الجملة وهدايا الشركات يوجّهها لعرض السعر الرسمي، وطلب الخصم يرد عليه بصراحة، ويراعي المناسبة والعلاقة وبلد الزائر (وفي العزاء مايبيعش).' },
  { id: 'library', nameAr: 'مكتبة شاهين (رد بدون ذكاء اصطناعي)', nameEn: "Shaheen's library (answers without AI)", dept: 'experience', dutiesAr: 'لما محركات الذكاء الاصطناعي تقع: يبني رد من موسوعة المواد الخام ودروس شاهين وأقرب سؤال في ذاكرته، مكتوب عليه مصدره، على السيرفر وفي متصفح الزائر. مايخمنش: الأخبار والأسعار والأسئلة الشخصية ليها الرد الصريح، وأسئلة الشراء لترشيحات المتجر.' },
  { id: 'specialists_board', nameAr: 'مجلس المتخصصين (وكيل الاستشارة الذكي)', nameEn: "The specialists' board (consultation agent)", dept: 'experience', aiTools: ['specialists_agent'], dutiesAr: 'أيقونة «استشير متخصصاً» في كل أقسام الموقع وكيل ذكاء اصطناعي: يفهم سؤال الزائر ويوجّهه لمتخصصه من العشرة (نطاق كل واحد مساراته من مدرسة شاهين بس — L-32)، ويشتغل بأدواته — منهج المدرسة وعلومها المراجَعة، ذاكرة شاهين ومكتبته، موسوعة المواد الخام، حاسبات المعمل، المتجر بأسعاره الحقيقية، نشرة الأخبار، ملجأ شاهين، والمصادر المفتوحة — ويرد من ملاحظات أدواته بس، وكل رد مكتوب عليه مصدره والأدوات اللي اشتغلت فيه. ولو المحركات كلها وقفت يرد من نفس الأدوات من غير ذكاء اصطناعي، ولو مفيش معلومة صلبة يقول بصراحة إنه هيذاكر السؤال ويسجّله للمدرسة — مافيش تخمين ولا اسم مزوّد للزائر.' },
  { id: 'languages', nameAr: 'وكيل اللغات — المترجم الذكي', nameEn: 'Language agent — smart translator', dept: 'experience', workflow: 'shaheen-languages.yml', report: 'shaheen-languages.json', everyHours: 12, aiTools: ['language_agent'], dutiesAr: 'يقيس اللغات المئة، ويترجم بالذكاء الاصطناعي كل نص لسه بالإنجليزي (فحص صارم + مراجعة محرك تاني)، ويبدأ باللغات اللي بلّغ عنها قسم التصميم ويحدد مكان النصوص الإنجليزي الثابتة في الكود.' },
  { id: 'design_audit', nameAr: 'تدقيق التصميم واللغات (مرتين في الأسبوع)', nameEn: 'Design & languages audit (twice a week)', dept: 'experience', workflow: 'shaheen-manus.yml', report: 'manus-audit.json', everyHours: 84, dutiesAr: 'وكيل خلفي يفتح الموقع بلغات مختلفة الأربع والسبت ويقيّم التصميم والترجمة.' },
  { id: 'design_expert', nameAr: 'خبير التصميم متعدد التخصصات', nameEn: 'Multidisciplinary design expert', dept: 'experience', aiTools: ['design_agent'], dutiesAr: 'يحوّل الموجز إلى خطة عبر تخصصات الهوية والجرافيك والواجهات والتغليف والتصوير والحركة والطباعة والإتاحة والخدمات والمنتجات، ويتعاون مع أدوار وتقارير برامج الذكاء المسجلة تحت شاهين؛ شاهين يراجع الجودة ويوجّه التحسين، ولا تُنفذ تغييرات أو ملفات نهائية تلقائياً.' },
  { id: 'visitor_tour', nameAr: 'جولة الزائر والمستشار الميداني', nameEn: 'Visitor tour & field advisor', dept: 'experience', workflow: 'shaheen-manus.yml', report: 'manus-missions.json', section: 'tour', everyHours: 24, dutiesAr: 'كل يوم بعد الفحص الشامل الوكيل الخلفي يتسوق من الموبايل زي الزبون: المتجر ← منتج ← السلة ← صفحة الدفع (من غير ما يدفع) ← سؤال لشاهين، وبعدين يبص على مشاكل الفحص في الموقع الحي ويقعد في الاجتماع «المستشار الميداني» برأيه واقتراحاته.' },
  { id: 'inspect', nameAr: 'فاحص إجابات شاهين', nameEn: 'Answer inspector', dept: 'experience', workflow: 'shaheen-inspect.yml', dutiesAr: 'يسأل شاهين أسئلة حقيقية ويفحص الرد (عند الطلب).' },
  // ── Reliability & self-reliance ──
  { id: 'school', nameAr: 'مدرسة شاهين (الاعتماد على النفس)', nameEn: "Shaheen's school", dept: 'reliability', workflow: 'shaheen-discover.yml', report: 'shaheen-school.json', everyHours: 6, aiTools: ['shaheen_school'], dutiesAr: 'يمتحن شاهين نفسه على كل المسارات — العطور، جميع لغات البرمجة، بناء بلوكات البرمجة وجدولتها، هندسة البرمجة، الجرافيك والديزاين، صيانة المواقع، والذكاء الاصطناعي بجميع مهاراته وأحدث العلوم، والاختراق الأخلاقي، وكل العلوم — ومجال كل أداة ذكاء اصطناعي — ويذاكر مكثفاً من مكتبته بدون مساعدة ويحفظ في ذاكرته عشان يرد لوحده ويدبر نفسه بدون أي تطبيق ذكاء آخر. ويبني برامجه بالبلوكات ويجدولها ويطوّر كل أداة في مجالها.' },
  { id: 'academy', nameAr: 'أكاديمية شاهين (المدرسة على مدار الساعة)', nameEn: "Shaheen's academy (school around the clock)", dept: 'reliability', workflow: 'shaheen-school-clock.yml', report: 'shaheen-school.json', everyHours: 1, dutiesAr: 'كل ساعة يشوف إيه الباقي على خبراء المدرسة التمنتاشر من منهجهم (من غير ذكاء اصطناعي)، ولو فيه شغل يشغّل المعلم المحلي على جهاز الروبوتات: كل خبير يذاكر أسئلة مجاله من مكتبة شاهين والمصادر المفتوحة، والمراجع الصارم يراجع كل درس بمعايير المجال وحدوده قبل ما يتحفظ في ذاكرة شاهين. لو مفيش حاجة باقية الساعة بتعدي من غير تشغيل، وماشي في نفس حارة الكشّاف عشان محدش يكتب في الذاكرة مع التاني. وكل ساعة كمان «حصّاد شاهين» يجهّز إجابات لأسئلة الزوار اللي ماتجاوبتش والأسئلة اليومية قبل ما الباقة تخلص (آخر ساعتين قبل التجديد من الباقي منها، وباقي اليوم من نماذج مفتوحة ليها حصة منفصلة) ويحفظ الكويس منها بس، عشان شاهين يرد منها لما المنصات تقف.' },
  { id: 'lab', nameAr: 'المُجرِّب (معمل شاهين)', nameEn: 'The Experimenter (Shaheen lab)', dept: 'innovation', workflow: 'shaheen-lab.yml', report: 'shaheen-lab.json', everyHours: 24, dutiesAr: 'يقود «معمل شاهين للتجارب والابتكار»: يصمم تجارب كل المجالات بفرضية ومتغيرات وضوابط وسلامة، ويوثّق النتائج صادقة بلا تجميل، ويدير خريطة التعاون بين العلوم ويجرّب التقاطعات، ويقرأ الأبحاث الراسخة ويوثّقها، ويرعى خط إنتاج المنتجات من الفكرة للسوق، ويكتب تقرير المعمل يومياً.' },
  { id: 'doctor', nameAr: 'طبيب شاهين (الصيانة)', nameEn: 'Shaheen doctor (maintenance)', dept: 'reliability', workflow: 'shaheen-doctor.yml', dutiesAr: 'كل 10 دقايق يكشف على المنتجات والصور والمتجر والنشر.' },
  { id: 'verifier', nameAr: 'المراجع الخارجي', nameEn: 'External reviewer', dept: 'reliability', workflow: 'shaheen-manus.yml', report: 'manus-missions.json', section: 'verify', everyHours: 84, dutiesAr: 'الاتنين والخميس الوكيل الخلفي يراجع مهام التطوير اللي اتقفلت على الموقع الحي: اتصلحت فعلاً ولا لأ — اللي لسه بايظ يرجع للاجتماع.' },
  { id: 'live_check', nameAr: 'فحص شاهين على الموقع الحي', nameEn: 'Live Shaheen check', dept: 'reliability', workflow: 'live-smoke.yml', everyHours: 24, dutiesAr: 'يكلم شاهين على الموقع الحقيقي كل يوم ويتأكد إنه بيرد.' },
  { id: 'keys', nameAr: 'حارس مفاتيح الذكاء الاصطناعي', nameEn: 'AI keys keeper', dept: 'reliability', workflow: 'shaheen-keys.yml', report: 'ai-quota.json', dutiesAr: 'يتأكد إن مفاتيح المحركات شغالة ويتابع الباقات اللي خلصت.' },
  { id: 'intake', nameAr: 'مستقبل تحديثات AI Studio', nameEn: 'AI Studio intake', dept: 'reliability', workflow: 'aistudio-intake.yml', report: 'aistudio-intake.json', dutiesAr: 'يراجع كل تحديث جاي من AI Studio قبل ما ينزل.' },
  { id: 'studio_bridge', nameAr: 'بوابة جوجل استوديو', nameEn: 'AI Studio bridge', dept: 'reliability', workflow: 'aistudio-bridge.yml', report: 'aistudio-bridge.json', dutiesAr: 'كل نص ساعة ياخد تعديلات جوجل استوديو من مستودعه الخاص، يفلترها ويفحصها، وينشر السليم على الموقع — والباقي يستنى موافقة.' },
  { id: 'studio_zip', nameAr: 'مستلم ملفات جوجل استوديو المضغوطة', nameEn: 'AI Studio download intake', dept: 'reliability', workflow: 'aistudio-zip.yml', dutiesAr: 'لما جوجل استوديو ما يقدرش يرفع، ياخد الملف المضغوط اللي التاجر رفعه في المسودة الخاصة، يفلتره بنفس قواعد البوابة، ويحط الصافي في فرع للمراجعة.' },
  { id: 'deploy', nameAr: 'بناء ونشر الموقع', nameEn: 'Build & deploy', dept: 'reliability', workflow: 'pages.yml', dutiesAr: 'يفحص ويبني وينشر الموقع على GitHub Pages مع كل تعديل.' },
  { id: 'chat_agent', nameAr: 'وكيل البرمجة في الشات (منفّذ مهام شاهين)', nameEn: 'Coding agent in the chat (Shaheen task runner)', dept: 'reliability', dutiesAr: 'يدخل من شات وكيل البرمجة لما التاجر يكتب «نفذ مهام شاهين»: يراجع مهام الاجتماع والدورية المفتوحة، ينفذها على فرع الجلسة، ويشغّل lint والاختبارات والبناء قبل أي دمج؛ وقبل أي مهمة كبيرة أو خطرة يستأذن التاجر. كمان بيعمل الصيانة الدورية للموقع ومراجعة أدوات الذكاء الاصطناعي اللي أداؤها بايظ (فشل تشغيل، تقرير مغلوط، بيانات ناقصة) ويصلحها من غير ما يخترع بيانات، ويرد على التاجر بالمصري من غير تفاصيل تقنية.' },
  { id: 'admin_agent', nameAr: 'المساعد الإداري', nameEn: 'Admin operations agent', dept: 'reliability', aiTools: ['admin_agent'], dutiesAr: 'تقارير الإدارة الذكية من أدوات قراءة فقط.' },
  { id: 'specialist_scents', nameAr: 'د. ليان العطور', nameEn: 'Dr. Layan Al-Atyar — perfume & chemistry specialist', dept: 'store', dutiesAr: 'متخصص العطور والكيمياء (النطاق بتاعه هو ده بس — L-32): العطور وصناعتها والخلطات والهرم العطري والمواد الخام والكيمياء. يستشاره الزائر وأقسام الموقع كلها (المتجر، الحاسبات، المواد الخام، الدليل) في أي وقت حتى من غير إنترنت، ويرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. مايقدرش يقول حاجة مش متأكد منها: لو الإجابة مش موجودة يقول بصراحة إنه هيذاكر السؤال، والتخمين ممنوع.' },
  { id: 'specialist_tech', nameAr: 'م. عمر الحاسوب', nameEn: 'Eng. Omar Al-Hasib — computing & AI specialist', dept: 'content', dutiesAr: 'متخصص الحوسبة والذكاء الاصطناعي (النطاق بتاعه هو ده بس — L-32): لغات البرمجة وبلوكاتها وهندسة البرمجة والجرافيك والديزاين وصيانة المواقع والذكاء الاصطناعي ومهاراته وأدواته ومشاريعه وعلوم تقنية المعلومات والحوسبة الكمية. يستشاره الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، ويرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. لو الإجابة مش موجودة يقول بصراحة إنه هيذاكر السؤال، والتخمين ممنوع.' },
  { id: 'specialist_security', nameAr: 'م. سيف الأمن', nameEn: 'Eng. Seif Al-Amn — cybersecurity specialist', dept: 'reliability', dutiesAr: 'متخصص الأمن السيبراني (النطاق بتاعه هو ده بس — L-32): أمن المعلومات والهجمات والدفاع عنها والتشفير والمصادقة وحماية كلمات السر والخصوصية والاستجابة للحوادث والتشفير ما بعد الكم. يستشاره الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، ويرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. مايكتبش أبداً أي مفتاح أو كلمة سر حقيقية، ولو الإجابة مش موجودة يقول بصراحة إنه هيذاكر السؤال.' },
  { id: 'specialist_science', nameAr: 'د. هند العلوم', nameEn: 'Dr. Hind Al-Ulum — science & math specialist', dept: 'content', dutiesAr: 'متخصص الفيزياء والرياضيات والعلوم النادرة (النطاق بتاعهم هم بس — L-32): قوانين الفيزياء والكهرباء والضوء والصوت والكم والفلك، والجبر والتفاضل والاحتمالات والإحصاء والمصفوفات، والبصريات والصوتيات والبلورات والنانو والمياه والتربة. تستشارها الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، وترد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على ردها مصده. لو الإجابة مش موجودة تقول بصراحة إنها هتذاكر السؤال، والتخمين ممنوع.' },
  { id: 'specialist_business', nameAr: 'أ. طارق التجارة', nameEn: 'Tarek Al-Tigara — commerce, law & management specialist', dept: 'store', dutiesAr: 'متخصص التجارة والقانون والإدارة والعلاقات العامة (النطاق بتاعهم هم بس — L-32): التجارة الدولية والتسويق والتمويل والمحاسبة واللوجستيات، والقوانين المحلية والدولية والملكية الفكرية والجريمة الإلكترونية، والإدارة والمشاريع والقيادة والمخاطر، والعلاقات العامة وإدارة السمعة والأزمات. يستشاره الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، ويرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. القرارات القانونية النهائية للمدير القانوني، والتخمين ممنوع.' },
  { id: 'specialist_society', nameAr: 'أ. مريم المجتمع', nameEn: 'Mariam Al-Mujtama — humanities, society & psychology specialist', dept: 'experience', dutiesAr: 'متخصص الإنسانيات والمجتمع والنفس (النطاق بتاعهم هم بس — L-32): التاريخ والحضارات والجغرافيا والمناخ، والأدب والشعر والرواية والفلسفة والترجمة، والعلوم الاجتماعية والسياسة والتربية والأخلاق، وعلم النفس وسلوك المستخدمين وتجربة المستخدم. تستشارها الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، وترد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على ردها مصده. لو الإجابة مش موجودة تقول بصراحة إنها هتذاكر السؤال، والتخمين ممنوع.' },
  { id: 'specialist_health', nameAr: 'د. سلمى الحياة', nameEn: 'Dr. Salma Al-Hayat — life & medical sciences specialist', dept: 'content', dutiesAr: 'متخصص العلوم البيولوجية والطب والصحة (النطاق بتاعهم هم بس — L-32): علم الأحياء والخلية والنبات والحيوان والتشريح والوظائف والوراثة والتكنولوجيا الحيوية والمناعة والأمراض، والطب والصيدلة والتمريض والإسعافات والتغذية والصحة العامة والأوبئة والأسنان والبيطري والعلاج الطبيعي. تستشارها الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، وترد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على ردها مصده. ما تقدّمش نصيحة طبية بديلة عن الطبيب، ولو الإجابة مش موجودة تقول بصراحة إنها هتذاكر السؤال.' },
  { id: 'specialist_engineering', nameAr: 'م. ياسين الهندسة', nameEn: 'Eng. Yassin Al-Handasa — engineering & earth sciences specialist', dept: 'store', dutiesAr: 'متخصص الهندسة وعلوم الأرض والفضاء (النطاق بتاعهم هم بس — L-32): الهندسة المدنية والميكانيكية والكهربائية والإلكترونيات والصناعية والعمارة والبترول والمناجم والطيران والبحرية والميكاترونكس والطاقة والسيارات، وعلوم البيئة والتنوّع والاستدامة وتغير المناخ والآثار والجيوفيزياء والأحافير والفضاء والأقمار. يستشاره الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، ويرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. لو الإجابة مش موجودة يقول بصراحة إنه هيذاكر السؤال، والتخمين ممنوع.' },
  { id: 'specialist_learning', nameAr: 'أ. نورة التربية', nameEn: 'Noura Al-Tarbiya — education & information sciences specialist', dept: 'content', dutiesAr: 'متخصص التربية والتعليم والاعلام وعلوم المعلومات (النطاق بتاعهم هم بس — L-32): المناهج وطرق التدريس والتربية الخاصة والقياس والتقويم والتعليم الإلكتروني وتكنولوجيا التعليم ودمج ذوي الإعاقة، والاعلام والصحافة والتحقق من المعلومات ومحو الأمية الإعلامية وعلوم المكتبات والأرشيف وعلم البيانات والبيانات الضخمة. تستشارها الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، وترد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على ردها مصده. لو الإجابة مش موجودة تقول بصراحة إنها هتذاكر السؤال، والتخمين ممنوع.' },
  { id: 'specialist_culture', nameAr: 'أ. رضا الثقافة', nameEn: 'Reda Al-Thaqafa — arts, sports, faith & diplomacy specialist', dept: 'experience', dutiesAr: 'متخصص الرياضة والفنون والفلسفة والعقائد والسياحة والعلاقات الدولية (النطاق بتاعهم هم بس — L-32): علوم الرياضة والتدريب واللياقة، والرسم والنحت والخط العربي والموسيقى والسينما والتصوير والطهي، والفلسفة والمنطق والأخلاق والدراسات الإسلامية والدينية المقارنة، وعلم السياحة والضيافة والعلاقات الدولية والدبلوماسية والمفاوضات. يستشاره الزائر وأقسام الموقع كلها في أي وقت حتى من غير إنترنت، ويرد من علوم مدرسة شاهين وذاكرته ومكتبته ومكتوب على رده مصده. يحترم العقائد ولا يفتي في الأمور الدينية، ولو الإجابة مش موجودة يقول بصراحة إنه هيذاكر السؤال.' },
];

/** The secretary: which bot deputises for Shaheen, and what it does then. */
export const SECRETARY = {
  bot: 'secretary' as BotId,
  dutiesAr: [
    'يجهز جدول أعمال الاجتماع من الفحص الشامل (قبل الاجتماع بساعتين).',
    'يرأس الاجتماع بدل شاهين لو مفيش محرك ذكاء اصطناعي، أو الباقات خلصت، أو شاهين ما ردش، أو الضغط عالي.',
    'ينفذ القرارات الآمنة بس (تشغيل روبوت، سؤال للمدرسة، متجر للكشّاف) ويحوّل الباقي لمهام.',
    'يوزع طلبات المساعدة بين الأدوات.',
    'يسجل كل حاجة عملها بالنيابة، وشاهين يراجعها في أول اجتماع بعدها.',
  ],
};

/**
 * Decisions of «المدير القانوني» in force: binding on Shaheen and every tool — the pre-meeting check shows them as
 * legal decisions (not faults), and the council may never propose working around them. Only the legal manager
 * lifts one (for L-03: the supplier's written permission — docs/legal/scraper-permission.md for all, or a signed and approved
 * agreement per store through «مسؤول التعاقدات», L-40).
 */
export interface LegalDecision { id: string; bot: BotId; textAr: string }
export const LEGAL_DECISIONS: LegalDecision[] = [
  { id: 'L-03', bot: 'importer', textAr: 'نقل منتجات جديدة من المتاجر متوقف بقرار المدير القانوني لحد ما يوصل إذن مكتوب من المورد؛ الكتالوج الحالي شغال ويتراجع عادي. الإذن بيوصل عن طريق «مسؤول التعاقدات»: المتجر اللي وقّع الاتفاقية إلكترونياً واعتمده المدير القانوني بس هو اللي يتنقل (L-40).' },
  { id: 'L-40', bot: 'contracts', textAr: 'التعاقد مع المتاجر بمعايير المدير القانوني C-01…C-10: الرسائل يبعتها عضو حقيقي من الفريق باسمه ومن غير إنكار استخدام الذكاء الاصطناعي، قيمة الهامش ماتتكشفش ومافيش كذب عنها، مافيش رابط للمتجر قبل الموافقة، وسطر لإيقاف المراسلة في أول رسالة، والاعتماد النهائي قبل النقل للمدير القانوني.' },
  { id: 'L-06', bot: 'chat', textAr: 'كل رد ذكاء اصطناعي عليه إفصاح إنه مولد بالذكاء الاصطناعي، من غير ذكر أسماء المزودين للزوار.' },
];

/** Who helps whom: the cooperation map (from → to, and why). */
export interface Link { from: BotId; to: BotId; whyAr: string }
export const LINKS: Link[] = [
  { from: 'academy', to: 'teacher', whyAr: 'كل ساعة فيها أسئلة باقية: الأكاديمية تشغّل المعلم المحلي يذاكر منهج خبراء المدرسة، والمراجع يراجع كل درس' },
  { from: 'academy', to: 'chat', whyAr: 'الدروس اللي عدّت المراجعة بتوصل لذاكرة شاهين، فوكيل شاهين يرد بيها على الزوار من غير أي منصة' },
  { from: 'owner_desk', to: 'state', whyAr: 'صاحب الموقع بيسلّم الدولة الموافقات أو يرجّعها لنفسه، وأي قرار ليها يقدر يرجّعه' },
  { from: 'state', to: 'council', whyAr: 'الدولة بتوافق أو ترفض مهام المجلس (بتصويت أعضائها)' },
  { from: 'state', to: 'doctor', whyAr: 'تعديلات الروبوتات المستنية موافقة ← الدولة تصوّت وتفحص وتدمج' },
  { from: 'state', to: 'chat', whyAr: 'الربط المباشر بين وكيل شاهين وشاهين تحت نظرها (S-10): كل رد مكتوب مصدره، وتقدر توقف الربط أو ترجّعه بأمر' },
  { from: 'owner_desk', to: 'council', whyAr: 'أوامر صاحب الموقع (إيقاف/تشغيل/فرامل) ← الاجتماع والمهام بتمشي عليها' },
  { from: 'owner_desk', to: 'doctor', whyAr: 'حدود التطوير الذاتي ← التغيير الكبير يستنى موافقة صاحب الموقع' },
  { from: 'owner_desk', to: 'patrol', whyAr: 'الروبوت الموقوف بأمره ← الدورية ماتشغلوش ولا تعتبره عطلان' },
  { from: 'platform_owner', to: 'state', whyAr: 'كل تعديل له يقرّه تصويت دولة المنصة قبل النزول، وهو خاضع لرقابتها' },
  { from: 'platform_owner', to: 'owner_desk', whyAr: 'أوامر صاحب الموقع فوق أوامره، ويقدر يرجّع أي قرار له في أي وقت' },
  { from: 'platform_owner', to: 'council', whyAr: 'يتلقى مهام التطوير من مجلس شاهين وينفّذها مثل وكيل البرمجة في الشات' },
  { from: 'librarian', to: 'council', whyAr: 'شاهين يراجع موضع المكتبة وتطويرها؛ الفهرسة محلية عند الطلب' },
  { from: 'librarian', to: 'school', whyAr: 'قائمة دراسة داخلية فقط؛ لا تتحول المراجع إلى معرفة متعلمة دون اطلاع قانوني ومراجعة موثقة، ولا تعرض ملاحظاتها للزوار' },
  { from: 'legal', to: 'librarian', whyAr: 'يراجع حقوق المصادر والاقتباس والترجمة لكل نسخة قبل النشر؛ لا تعتبر الخطة أو الفحص الآلي موافقة قانونية' },
  { from: 'languages', to: 'librarian', whyAr: 'تعريب بيانات الفهرس دون ادعاء ترجمة الكتب' },
  { from: 'finance', to: 'secretary', whyAr: 'حالة الفحص المنقحة فقط؛ الأرقام والطلبات تبقى خاصة' },
  { from: 'finance', to: 'council', whyAr: 'تصعيد أعطال الدفع والتسجيل للمراجعة دون أسرار أو تحويل أموال' },
  { from: 'keys', to: 'finance', whyAr: 'جاهزية إعدادات الخادم؛ اعتماد الحساب قرار صاحب المتجر' },
  { from: 'patrol', to: 'council', whyAr: 'مشكلة ماتصلحتش ولا شاهين حلها ← مهمة تطوير' },
  { from: 'patrol', to: 'secretary', whyAr: 'تقييم الدورية بالتناوب ← مادة للمشرف' },
  { from: 'patrol', to: 'doctor', whyAr: 'الخادم أو الموقع واقع ← كشف وصيانة' },
  { from: 'patrol', to: 'deploy', whyAr: 'صفحات قديمة أو واقعة ← إعادة نشر' },
  { from: 'precheck', to: 'council', whyAr: 'تقارير كل الأدوات = جدول أعمال الاجتماع' },
  { from: 'legal', to: 'council', whyAr: 'القرارات القانونية ملزمة — الاجتماع مايقترحش تجاوزها' },
  { from: 'legal', to: 'importer', whyAr: 'نقل المنتجات بإذن مكتوب من المورد بس (L-03)' },
  { from: 'legal', to: 'contracts', whyAr: 'معايير رسائل واتفاقية التعاقد (L-40)' },
  { from: 'contracts', to: 'importer', whyAr: 'المتاجر الموقّعة والمعتمدة بس ← يتنقل منها (L-03)' },
  { from: 'legal', to: 'chat', whyAr: 'إفصاح الذكاء الاصطناعي من غير أسماء المزودين' },
  { from: 'secretary', to: 'council', whyAr: 'ينوب عن شاهين وقت الضغط' },
  { from: 'council', to: 'scout', whyAr: 'متاجر يفحصها' },
  { from: 'council', to: 'school', whyAr: 'أسئلة يذاكرها' },
  { from: 'secretary', to: 'chat', whyAr: 'توجيهات جودة للردود' },
  { from: 'secretary', to: 'seo', whyAr: 'تقييم وتوجيهات' },
  { from: 'scout', to: 'importer', whyAr: 'متجر موثوق جديد ← ينقل منتجاته' },
  { from: 'importer', to: 'images', whyAr: 'صور منتجات جديدة ← تنظيفها' },
  { from: 'importer', to: 'catalog', whyAr: 'منتجات جديدة ← تصحيح البيانات والنوتات' },
  { from: 'catalog', to: 'seo', whyAr: 'أوصاف أقوى ← ظهور أفضل في البحث' },
  { from: 'seo', to: 'catalog', whyAr: 'صفحات ضعيفة في البحث ← تحسين أوصافها' },
  { from: 'product_pages', to: 'importer', whyAr: 'صفحة منتج مكسورة ← المراجع يخفيها' },
  { from: 'news', to: 'school', whyAr: 'دروس جديدة ← مادة للمذاكرة' },
  { from: 'school', to: 'chat', whyAr: 'ذاكرة شاهين ← رد بدون ذكاء اصطناعي وقت الضغط' },
  { from: 'school', to: 'importer', whyAr: 'مهارات قراءة صفحات المتاجر بدون ذكاء اصطناعي' },
  { from: 'design_audit', to: 'languages', whyAr: 'اللغات نص المترجمة تتترجم الأول + أماكن النصوص الإنجليزي الثابتة' },
  { from: 'languages', to: 'design_audit', whyAr: 'تقرير الترجمة والفئات اللي مش بتنعكس يمين/شمال ← التدقيق الجاي يتأكد' },
  { from: 'design_audit', to: 'design_expert', whyAr: 'تدقيق التصميم يمد الخطط بملاحظات التباين والاستجابة والموبايل' },
  { from: 'languages', to: 'design_expert', whyAr: 'توطين المحتوى واتجاه RTL والحزم اللغوية' },
  { from: 'visitor_tour', to: 'design_expert', whyAr: 'ملاحظات رحلة المستخدم الفعلية على الهاتف' },
  { from: 'catalog', to: 'design_expert', whyAr: 'حقائق المنتج المعتمدة للتصاميم التي تستخدم منتجاً محدداً' },
  { from: 'design_expert', to: 'council', whyAr: 'تقييم شاهين ومقترحات التحسين متعددة التخصصات تدخل الاجتماع اليومي' },
  { from: 'precheck', to: 'visitor_tour', whyAr: 'مشاكل الفحص الشامل ← المستشار الميداني يتأكد منها على الموقع الحي' },
  { from: 'visitor_tour', to: 'council', whyAr: 'رأي واقتراحات المستشار الميداني + خطوات الشراء الواقعة ← بنود في الاجتماع' },
  { from: 'visitor_tour', to: 'product_pages', whyAr: 'صفحات منتجات أو صور مكسورة' },
  { from: 'verifier', to: 'council', whyAr: 'مهمة اتقفلت ولسه مش متصلحة ← تتفتح تاني' },
  { from: 'languages', to: 'chat', whyAr: 'لغة وأرقام صحيحة للزائر' },
  { from: 'live_check', to: 'doctor', whyAr: 'شاهين مش بيرد على الموقع ← كشف وصيانة' },
  { from: 'doctor', to: 'deploy', whyAr: 'إصلاح ← إعادة نشر' },
  { from: 'keys', to: 'secretary', whyAr: 'باقات خلصت ← السكرتير يمسك الاجتماع' },
  { from: 'studio_zip', to: 'studio_bridge', whyAr: 'نفس فلتر البوابة للملفات المضغوطة' },
  { from: 'studio_bridge', to: 'intake', whyAr: 'كل تحديث بيعدي من البوابة بيتراجع تاني بعد النشر' },
  { from: 'studio_bridge', to: 'deploy', whyAr: 'تعديلات الاستوديو السليمة ← نشر الموقع' },
  { from: 'intake', to: 'deploy', whyAr: 'تحديث سليم ← ينزل على الموقع' },
  { from: 'inspect', to: 'secretary', whyAr: 'ردود ضعيفة ← توجيهات جودة' },
  { from: 'library', to: 'chat', whyAr: 'المحركات واقعة ← رد من الموسوعة والدروس والذاكرة بمصدره' },
  { from: 'library', to: 'specialists_board', whyAr: 'المحركات واقعة ← المجلس يرد من المكتبة والذاكرة وموسوعة المواد بمصدرها' },
  { from: 'researcher', to: 'specialists_board', whyAr: 'سؤال جديد مش في الذاكرة ولا المكتبة ← خلاصة المصادر المفتوحة بروابطها' },
  { from: 'specialists_board', to: 'school', whyAr: 'سؤال مالقاش إجابة صلبة ← يتسجل في فجوات المعرفة والمدرسة تذاكره' },
  { from: 'specialists_board', to: 'chat', whyAr: 'سؤال تركيبات أو طلب أو خدمة ← يتسلّم بصراحة للخبير شاهين أو مساعد شام باسمه' },
  { from: 'secretary', to: 'specialists_board', whyAr: 'تقييم وتوجيهات جودة لوكيل المجلس زي كل أدوات الذكاء الاصطناعي' },
  { from: 'researcher', to: 'chat', whyAr: 'سؤال جديد مش في المكتبة ← خلاصة المصادر المفتوحة بروابطها' },
  { from: 'chat', to: 'school', whyAr: 'سؤال ماتجاوبش من محرك ← على قائمة المذاكرة' },
  { from: 'school', to: 'library', whyAr: 'الدروس والذاكرة ← مادة المكتبة' },
  { from: 'researcher', to: 'teacher', whyAr: 'خلاصة المصادر ← مراجع للدرس' },
  { from: 'teacher', to: 'school', whyAr: 'دروس مراجَعة من غير مفتاح ← ذاكرة شاهين' },
  { from: 'council', to: 'chat_agent', whyAr: 'مهمة تطوير مفتوحة ← الوكيل ينفذها ويقفلها بـ PR' },
  { from: 'maneuver', to: 'state', whyAr: 'كل خطأ وفكرة تطوير من الموقع الحي ← الدولة تحدد القطاع والروبوت المسؤول، والخطير يبقى مهمة' },
  { from: 'state', to: 'chat_agent', whyAr: 'أخطاء المناورة الخطيرة بعد تصويت الأعضاء ← مهمة تطوير للوكيل' },
  { from: 'maneuver', to: 'chat', whyAr: 'محادثات تدريب حقيقية مع شاهين ← أي رد غلط بيتسجل ويتصلح' },
  { from: 'patrol', to: 'chat_agent', whyAr: 'عطل ماتصلحش لوحده ← مهمة تطوير للوكيل' },
  { from: 'verifier', to: 'chat_agent', whyAr: 'مهمة اتقفلت ولسه بايظة ← تتنفذ تاني بمراجعة الوكيل' },
  { from: 'chat_agent', to: 'deploy', whyAr: 'إصلاح اتدمج ← نشر الموقع بالنسخة الجديدة' },
  { from: 'chat_agent', to: 'secretary', whyAr: 'اللي اتعمل واللي مستني موافقة التاجر ← مادة للمشرف' },
  { from: 'chat_agent', to: 'doctor', whyAr: 'عطل بيظهر على الموقع الحي ← كشف وصيانة' },
  { from: 'legal', to: 'researcher', whyAr: 'مصادر رسمية مفتوحة بس وذكر المصدر (CC BY-SA) — مافيش قراءة لصفحات نتائج جوجل' },
  { from: 'school', to: 'specialist_scents', whyAr: 'علوم العطور والكيمياء من منهج مدرسة شاهين؛ المتخصص يذاكر دروسها ويحدّث معرفته منها' },
  { from: 'school', to: 'specialist_tech', whyAr: 'علوم الحوسبة والذكاء الاصطناعي من منهج مدرسة شاهين؛ المتخصص يذاكر دروسها ويحدّث معرفته منها' },
  { from: 'school', to: 'specialist_security', whyAr: 'علوم الأمن السيبراني من منهج مدرسة شاهين؛ المتخصص يذاكر دروسها ويحدّث معرفته منها' },
  { from: 'school', to: 'specialist_science', whyAr: 'علوم الفيزياء والرياضيات والعلوم النادرة من منهج مدرسة شاهين؛ المتخصصة تذاكر دروسها وتحدّث معرفتها منها' },
  { from: 'school', to: 'specialist_business', whyAr: 'علوم التجارة والقانون والإدارة من منهج مدرسة شاهين؛ المتخصص يذاكر دروسها ويحدّث معرفته منها' },
  { from: 'school', to: 'specialist_society', whyAr: 'علوم الإنسانيات والمجتمع والنفس من منهج مدرسة شاهين؛ المتخصصة تذاكر دروسها وتحدّث معرفتها منها' },
  { from: 'specialist_scents', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_tech', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_security', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_science', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_business', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_society', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_scents', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_tech', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_security', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_science', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_business', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_society', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'school', to: 'specialist_health', whyAr: 'علوم البيولوجيا والطب من منهج مدرسة شاهين؛ المتخصصة تذاكر دروسها وتحدّث معرفتها منها' },
  { from: 'school', to: 'specialist_engineering', whyAr: 'علوم الهندسة والأرض والفضاء من منهج مدرسة شاهين؛ المتخصص يذاكر دروسها ويحدّث معرفته منها' },
  { from: 'school', to: 'specialist_learning', whyAr: 'علوم التربية والاعلام والمعلومات من منهج مدرسة شاهين؛ المتخصصة تذاكر دروسها وتحدّث معرفتها منها' },
  { from: 'school', to: 'specialist_culture', whyAr: 'علوم الرياضة والفنون والعقائد والسياحة من منهج مدرسة شاهين؛ المتخصص يذاكر دروسها ويحدّث معرفته منها' },
  { from: 'specialist_health', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_engineering', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_learning', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_culture', to: 'chat', whyAr: 'استشارة أقسام الموقع وزوّارها في أي وقت؛ الرد من علوم المدرسة والذاكرة والمكتبة بدون إنترنت وبدون ذكاء اصطناعي' },
  { from: 'specialist_health', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_engineering', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_learning', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
  { from: 'specialist_culture', to: 'council', whyAr: 'استشارة داخلية للمجلس والدولة الداخلية ولأي روبوت محتاج معلومة متخصصة من ملجأ شاهين' },
];

export const botOf = (id: string) => BOTS.find((b) => b.id === id);
export const deptOf = (id: DeptId) => DEPARTMENTS.find((d) => d.id === id)!;
export const botsIn = (dept: DeptId) => BOTS.filter((b) => b.dept === dept);
/** The bot an AI tool belongs to. */
export const botOfTool = (tool: AiToolId) => BOTS.find((b) => b.aiTools?.includes(tool));

/** The structure as a Mermaid diagram (GitHub renders it; SHAHEEN_ORG.md). */
export function orgMermaid(): string {
  const q = (s: string) => s.replace(/"/g, "'");
  const lines = ['flowchart TB', `  shaheen(["${q('الخبير شاهين — المدير العام')}"])`, `  shaheen --- secretary`];
  for (const d of DEPARTMENTS) {
    lines.push(`  subgraph ${d.id}["${q(d.nameAr)}"]`, '    direction TB');
    for (const b of botsIn(d.id)) lines.push(`    ${b.id}["${q(b.nameAr)}"]`);
    lines.push('  end');
    if (d.id !== 'leadership') lines.push(`  shaheen --> ${d.id}`);
  }
  for (const l of LINKS) lines.push(`  ${l.from} -.->|"${q(l.whyAr)}"| ${l.to}`);
  return lines.join('\n');
}

/** Every AI tool has a home (used by tests and the map). */
export const unplacedTools = () => AI_TOOLS.filter((t) => !botOfTool(t.id)).map((t) => t.id);
