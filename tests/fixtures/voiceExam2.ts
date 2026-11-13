/** «الامتحان التاني»: written after the fixes for the first exam, run once for an honest score (never tuned on). */
export const EXAM2_TURNS: Array<[string, 'done' | 'more' | 'unsure', { answering?: boolean }?]> = [
  ['هو الشحن مجاني', 'done'], ['العطور دي اصلية', 'done'], ['عندكم فرع في اسكندرية', 'done'], ['ايه اكتر عطر بيتباع', 'done'],
  ['انا عايز ارجع الاوردر', 'done'], ['السعر ده شامل الشحن', 'done'], ['ابي عطر عودي ثابت للشتاء', 'done'], ['شو سعر التوصيل لعمان', 'done'],
  ['how do I track my order', 'done'], ['which one lasts longer', 'done'],
  ['انا عايز حاجة تكون', 'more'], ['هو ده يعني', 'more'], ['عندي سؤال عن', 'more'], ['بس المشكلة ان', 'more'], ['انا كنت', 'more'],
  ['اختي بتحب', 'more'], ['ابغى شي يكون', 'more'], ['I would like', 'more'], ['the thing is', 'more'],
  ['ماشي يا سيدي', 'done'], ['اوكي تمام', 'done'], ['خلاص اتفقنا', 'done'], ['okay great', 'done'],
  ['عطر حلو', 'unsure'], ['للخروج', 'unsure'],
  ['اه رجالي', 'done', { answering: true }], ['لا مش مهم', 'done', { answering: true }],
];
export const EXAM2_ADDRESS: Array<[string, 'shaheen' | 'other' | 'unsure']> = [
  ['استنى بس', 'shaheen'], ['طب وده ثابت', 'shaheen'], ['لا غالي', 'shaheen'], ['قول تاني', 'shaheen'], ['عايز اعرف الفرق', 'shaheen'],
  ['تمام وكام سعره', 'shaheen'], ['فيه منه حريمي', 'shaheen'], ['can you repeat', 'shaheen'], ['hold on', 'shaheen'],
  ['يا بنتي البسي الجزمة', 'other'], ['الو ازيك', 'other'], ['هاتلي المية', 'other'], ['ثواني يا عم', 'other'], ['روح العب برة', 'other'],
  ['ماما انا جعان', 'other'], ['hey come here', 'other'], ['تعالى يا محمد', 'other'],
];
export const EXAM2_CLEAN = [
  'انا عايز ابعت هدية لخطيبتي', 'الطلب بتاعي اتأخر', 'ريحته بتفضل على الهدوم يومين', 'ممكن تبعتلي صور', 'عندي فرح اخويا',
  'انا بشتغل في بنك', 'الاقي فين الكود', 'عايز اعرف مدة الشحن', 'ابي عطر للدوام', 'شو بتنصحني', 'ريحة العطر خفيفة اوي',
  'انا عايز عطر بيفكرني بالبحر', 'what do you recommend for summer',
];
export const EXAM2_MISHEARD: Array<{ said: string; meant: string; context?: string }> = [
  { said: 'عايز عطر فيه مسق', meant: 'عايز عطر فيه مسك' },
  { said: 'العمبر ريحته حلوة', meant: 'العنبر ريحته حلوة' },
  { said: 'فيه زافران', meant: 'فيه زعفران' },
  { said: 'طب سلطان العطور بكام', meant: 'طب سلطان العطور بكام', context: 'عندنا سلطان العطور' },
  { said: 'طب ملك العود بكام', meant: 'طب ملك العود بكام' },
  { said: 'طب ملك الأوت بكام', meant: 'طب ملك العود بكام', context: 'عندنا ملك العود وسلطان العطور' },
];
