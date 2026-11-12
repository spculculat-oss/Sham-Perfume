/**
 * «تدريب شاهين المكثف»: real-life voice moments, in the dialects and languages visitors use, with the right answer for
 * each. The bench (scripts/voice-bench.ts) scores Shaheen on them; the tests hold the scores at their bar.
 */

/** A paused sentence: finished ('done'), plainly going on ('more'), or not clear ('unsure' → «خلصت ولا لسه؟»). */
export const TURN_CASES: Array<[string, 'done' | 'more' | 'unsure', { answering?: boolean }?]> = [
  // Egyptian
  ['عندكم عود بكام؟', 'done'], ['عندكم عود بكام', 'done'], ['بكام الشحن للسعودية', 'done'], ['فين أقرب فرع ليكم', 'done'],
  ['ايه احسن عطر رجالي عندكم', 'done'], ['رشحلي عطر للصيف', 'done'], ['عايز عطر هادي للشغل ويكون ثباته عالي', 'done'],
  ['التوصيل بياخد قد ايه', 'done'], ['ممكن ادفع عند الاستلام', 'done'], ['الريحة دي بتفضل قد ايه على الهدوم', 'done'],
  ['انا عايز عطر يكون', 'more'], ['انا عايز', 'more'], ['عايز حاجة فريش عشان', 'more'], ['هو العود ولا', 'more'],
  ['بص انا محتاج', 'more'], ['طب لو انا', 'more'], ['عايزه هدية لجوزي بس', 'more'], ['اممم', 'more'], ['يعني', 'more'],
  ['كنت عايز اسأل على', 'more'], ['الريحة اللي', 'more'], ['عطر زي', 'more'],
  ['ايوه', 'done'], ['لا', 'done'], ['شكرا', 'done'], ['تمام', 'done'], ['ماشي', 'done'], ['خلاص', 'done'], ['مع السلامة', 'done'],
  ['عطر للشغل', 'unsure'], ['عود', 'unsure'], ['حاجة فريش', 'unsure'],
  // Answers to his own question
  ['رجالي', 'done', { answering: true }], ['للصيف', 'done', { answering: true }], ['حوالي الف جنيه', 'done', { answering: true }], ['مسك', 'done', { answering: true }],
  // Gulf / Levantine / Iraqi / Maghrebi
  ['وش عندكم من العود', 'done'], ['كم سعر الشحن للرياض', 'done'], ['شو في عندكن عطور نسائية', 'done'], ['شلون اطلب', 'done'],
  ['ابي عطر يكون', 'more'], ['بدي شي', 'more'], ['اريد عطر', 'more'], ['شنو احسن عطر عندكم', 'done'], ['بغيت عطر', 'more'],
  // English / French
  ['what is the best oud', 'done'], ['how much is shipping to dubai', 'done'], ['do you have vanilla perfumes', 'done'],
  ['I want a perfume and', 'more'], ['I need something that', 'more'], ['I was wondering if', 'more'], ['yes', 'done'], ['no thanks', 'done'],
  ['combien coûte la livraison', 'done'], ['je veux un parfum pour', 'more'],
];

/** Words heard while Shaheen talks: said to him, or to someone near the visitor (or not clear). */
export const ADDRESS_CASES: Array<[string, 'shaheen' | 'other' | 'unsure']> = [
  ['استنى', 'shaheen'], ['شاهين', 'shaheen'], ['ثانية واحدة', 'shaheen'], ['wait', 'shaheen'], ['لا لا مش ده', 'shaheen'],
  ['طب بكام ده', 'shaheen'], ['لا انا عايز حاجة ارخص', 'shaheen'], ['فيه شحن للسعودية', 'shaheen'], ['what about the price', 'shaheen'],
  ['طب والحريمي', 'shaheen'], ['ده غالي اوي', 'shaheen'], ['عايز حاجة تانية', 'shaheen'], ['قولي اسعارهم', 'shaheen'], ['فهمني تاني', 'shaheen'],
  ['يعني ايه فواحة', 'shaheen'], ['انت بتقول ايه', 'shaheen'], ['اعد تاني', 'shaheen'], ['ثباته كام ساعة', 'shaheen'], ['كمان واحد', 'shaheen'],
  ['هو ده رجالي', 'shaheen'], ['وش سعره', 'shaheen'], ['ابي ارخص', 'shaheen'], ['بدي شي اخف', 'shaheen'], ['how long does it last', 'shaheen'],
  ['يا ماما هاتي الشاي', 'other'], ['اقفل الباب يا احمد', 'other'], ['هات التليفون', 'other'], ['ايوه جاي', 'other'], ['حاضر يا بابا', 'other'],
  ['روح نام يا حبيبي', 'other'], ['مين على الباب', 'other'], ['الو ايوه انا في البيت', 'other'], ['خليك هنا', 'other'], ['اسكت يا ولد', 'other'],
  ['تعالي شوفي ده', 'other'], ['coming mom', 'other'], ['hold on honey', 'other'], ['يا عم اطفي التلفزيون', 'other'], ['ثواني يا ماما جاية', 'other'],
  ['حطي الاكل على السفرة', 'other'], ['الو مين معايا', 'other'], ['ماما بتنادي عليك', 'other'],
  ['حاضر', 'unsure'], ['اه', 'unsure'], ['ماشي', 'unsure'],
];

/** Everyday sentences that must reach Shaheen exactly as said (no «correction», no «قصدك…؟»). */
export const CLEAN_SENTENCES = [
  'انا عايز عطر للشغل يكون هادي', 'ممكن تقولي سعر الشحن للسعودية', 'طيب والتوصيل بياخد قد ايه', 'عايز حاجة فريش للصيف',
  'الريحه دي بتفضل قد ايه على الهدوم', 'ايه رأيك في عطر خشبي للمساء', 'انا مش فاهم قصدك', 'عايز اشتري هدية لصاحبي',
  'ريحته حلوة وثباتها عالي', 'عطوره حلوة بس غالية شوية', 'انا بحب الروايح التقيلة', 'مراتي بتحب الورد والفانيليا',
  'عندي فرح الاسبوع الجاي', 'بشتغل في مكتب ومش عايز ريحة قوية', 'عايز اجرب عينة الاول', 'الدفع بيكون ازاي',
  'ممكن ابدل لو مش عاجبني', 'العطر ده اصلي ولا تقليد', 'بيتحط على الرقبة ولا الهدوم', 'هو ده ينفع للبنات',
  'عندكم عروض النهارده', 'انا من جدة', 'ابعتلي اللينك على الواتساب', 'عايز حاجة شبه ديور سوفاج', 'كام مل الزجاجة دي',
  'الريحة بتاعته قوية اوي', 'عايز اطلب اتنين', 'هل في توصيل لدبي', 'انا مستعجل شوية', 'ابنتي عندها حساسية من الكحول',
  'وش افضل عطر للشتاء', 'ابي شي ثابت وفواح', 'شو احلى ريحة عندكن', 'شلون اعرف الاصلي', 'بغيت عطر ديال الرجال',
  'I want something fresh for work', 'how long does the delivery take', 'can I pay cash on delivery', 'is this original',
];

/** Misheard words (by a speech engine, or said in a dialect) → the word meant («|» = either spelling is right). */
export const MISHEARD_CASES: Array<{ said: string; meant: string; context?: string }> = [
  { said: 'عايز عطر فيه زعفلان', meant: 'عايز عطر فيه زعفران' },
  { said: 'عايز عطر فيه فانيليه', meant: 'عايز عطر فيه فانيليا' },
  { said: 'عايز بديأ العود', meant: 'عايز بديع العود', context: 'عندنا عطر لطافة بديع العود وعطر أمير العرب' },
  { said: 'طب امير العرف سعره كام', meant: 'طب امير العرب سعره كام', context: 'عندنا عطر لطافة بديع العود وعطر أمير العرب' },
  { said: 'عايز عطر فيه صندال', meant: 'عايز عطر فيه صندل' },
  { said: 'ريحة البتشولي حلوة', meant: 'ريحة الباتشولي حلوة' },
  { said: 'عايز مسك ابيد', meant: 'عايز مسك ابيض' },
  { said: 'فيه برغموط', meant: 'فيه برغموت|فيه برجموت' },
  { said: 'عايز عطر فيه ياسمبن', meant: 'عايز عطر فيه ياسمين' },
  { said: 'كم سعر دهن الأود', meant: 'كم سعر دهن العود' },
  { said: 'عايز حاجة فيها انبر', meant: 'عايز حاجة فيها عنبر' },
  { said: 'عايز عطر فيه كهرمان وزعفران', meant: 'عايز عطر فيه كهرمان وزعفران' },
  { said: 'I want a perfume with vetivr', meant: 'I want a perfume with vetiver' },
  { said: 'something with sandalwod', meant: 'something with sandalwood' },
];

/** Shaheen's own words coming back through the speakers (never an interruption) and the visitor's (always). */
export const ECHO_CASES: Array<{ reply: string; heard: string; barge: boolean }> = [
  { reply: 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.', heard: 'أنصحك بعطر فيه عود وصندل', barge: false },
  { reply: 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.', heard: 'عود وصندل مع لمسه فانيليا', barge: false },
  { reply: 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.', heard: 'ثباته عالي ومناسب', barge: false },
  { reply: 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.', heard: 'لا أنا عايز حاجة أرخص', barge: true },
  { reply: 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.', heard: 'استنى', barge: true },
  { reply: 'أنصحك بعطر فيه عود وصندل مع لمسة فانيليا، ثباته عالي ومناسب جداً لليالي الشتا.', heard: 'بكام الزجاجة الصغيرة', barge: true },
  { reply: 'This one has oud and sandalwood, and it lasts all day.', heard: 'oud and sandalwood', barge: false },
  { reply: 'This one has oud and sandalwood, and it lasts all day.', heard: 'how much is it', barge: true },
  { reply: 'سعره ألف ومية جنيه وبيوصلك في يومين.', heard: 'سعره الف ومية جنيه', barge: false },
  { reply: 'سعره ألف ومية جنيه وبيوصلك في يومين.', heard: 'طب فيه خصم', barge: true },
];
