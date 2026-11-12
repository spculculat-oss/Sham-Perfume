/**
 * «الامتحان»: cases kept apart from training (never tuned on) — the honest measure of how Shaheen does on talk he has
 * not seen. Add new real-life misses here first; move them to the training corpus only after the fix is general.
 */
export const HOLDOUT_TURNS: Array<[string, 'done' | 'more' | 'unsure', { answering?: boolean }?]> = [
  ['ايه الفرق بين الاو دو بارفان والاو دو تواليت', 'done'], ['العطر ده بيتباع فين', 'done'], ['انتو بتشحنوا للكويت', 'done'],
  ['عندكم حاجة شبه بلو شانيل', 'done'], ['انا كنت طالب اوردر امبارح ولسه موصلش', 'done'], ['بكام العينة', 'done'],
  ['ينفع اغير العنوان', 'done'], ['هو انت بني ادم ولا روبوت', 'done'], ['ازاي احافظ على العطر', 'done'],
  ['انا عايزة هدية لماما في عيد الام و', 'more'], ['محتاج عطر للفرح بتاعي بس يكون', 'more'], ['طب لو اخدت اتنين', 'more'],
  ['الحاجة اللي', 'more'], ['انا بدور على', 'more'], ['كنت بفكر في', 'more'], ['عايز اعرف لو', 'more'], ['بص يا سيدي', 'more'],
  ['وش رايك في', 'more'], ['ابي اعرف كم', 'more'], ['I am looking for', 'more'], ['can you tell me about', 'more'],
  ['متشكر جدا', 'done'], ['تمام كده', 'done'], ['اه بالظبط', 'done'], ['لا مش عايز', 'done'], ['thank you so much', 'done'],
  ['حاجة خشب', 'unsure'], ['للمسا', 'unsure'], ['ريحة ورد', 'unsure'],
  ['حريمي', 'done', { answering: true }], ['مش فارقة', 'done', { answering: true }], ['تقريبا ٥٠٠', 'done', { answering: true }],
];
export const HOLDOUT_ADDRESS: Array<[string, 'shaheen' | 'other' | 'unsure']> = [
  ['لا انا قصدي الرجالي', 'shaheen'], ['طب والشحن كام', 'shaheen'], ['ممكن تعيد السعر', 'shaheen'], ['ده نفس اللي قبله', 'shaheen'],
  ['مش فاهم', 'shaheen'], ['ثانية بس', 'shaheen'], ['اوكي وبعدين', 'shaheen'], ['فيه حاجة ارخص من كده', 'shaheen'],
  ['عايز اطلبه', 'shaheen'], ['ينفع هدية', 'shaheen'], ['is it for men', 'shaheen'], ['any discount', 'shaheen'],
  ['يا حبيبي نام بقى', 'other'], ['ماما الاكل جاهز', 'other'], ['هاتي الشنطة', 'other'], ['الو ايوه يا حبيبتي', 'other'],
  ['ايوه يا بابا جاي', 'other'], ['حد يفتح الباب', 'other'], ['اسكتوا شوية يا ولاد', 'other'], ['خد الريموت', 'other'],
  ['one second honey', 'other'], ['coming', 'other'],
];
export const HOLDOUT_CLEAN = [
  'انا ساكن في المعادي', 'ابعتلي على الايميل', 'هو ده متاح دلوقتي', 'عايز عطر ينفع للجيم', 'ريحته فواحة ولا هادية',
  'جربت عطر قبل كده وماعجبنيش', 'اختي عيد ميلادها بكرة', 'ممكن ادفع فودافون كاش', 'بحب الريحة اللي فيها قهوة',
  'انا بشتغل دكتور في مستشفى', 'العطر بيتغير على الجلد', 'عايز حاجة تنفع الصبح', 'وش الفرق بين الاثنين', 'كم يوم التوصيل للدمام',
  'بدي شي طيب للسهرات', 'ابغى عطر للمناسبات', 'شنو اكثر عطر ينباع', 'do you ship to Canada', 'I like sweet scents',
];
export const HOLDOUT_MISHEARD: Array<{ said: string; meant: string; context?: string }> = [
  { said: 'عايز عطر فيه ورض', meant: 'عايز عطر فيه ورد' },
  { said: 'فيه ريحة اللافاندر', meant: 'فيه ريحة اللافندر|فيه ريحة اللافاندر' },
  { said: 'عايز حاجة بالجهرمان', meant: 'عايز حاجة بالكهرمان' },
  { said: 'الأوت ده ثابت', meant: 'العود ده ثابت' },
  { said: 'طب خلطة العرصان بكام', meant: 'طب خلطة العرسان بكام', context: 'عندنا خلطة العرسان وخلطة الملوك' },
  { said: 'عايز ريحة فانيلا', meant: 'عايز ريحة فانيليا|عايز ريحة فانيلا' },
  { said: 'perfume with jasmin', meant: 'perfume with jasmine|perfume with jasmin' },
];
