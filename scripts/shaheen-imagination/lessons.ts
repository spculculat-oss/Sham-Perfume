/**
 * «بنك تدريب مرسم شاهين» — the ideas the painter is trained on. `known` ideas must come out with the right
 * place, time and subjects; `beyond` ideas are honest gaps: the painter must admit them (`missing`) instead of
 * drawing something else. Teaching a new subject = move its idea from `beyond` to `known` after adding it to
 * src/utils/shaheenPainter.ts.
 */
import type { PaintSetting, PaintSubject, PaintTime, PaintLook } from '../../src/utils/shaheenPainter';

export interface PaintLesson { id: string; idea: string; setting?: PaintSetting; time?: PaintTime; subjects?: PaintSubject[]; look?: PaintLook; extras?: string[]; guessed?: string[]; not?: PaintSubject[]; /** The painter must draw these subjects and nothing else. */ only?: boolean; beyond?: true }

export const PAINT_LESSONS: PaintLesson[] = [
  { id: 'bottle-space', idea: 'زجاجة عطر بنفسجية سابحة في الفضاء بين النجوم', setting: 'space', subjects: ['bottle'] },
  { id: 'bottle-marble', idea: 'زجاجة عطر وردية على رخام مع ورد وقت الغروب', setting: 'studio', time: 'sunset', subjects: ['bottle', 'rose'] },
  { id: 'desert-caravan', idea: 'قافلة جمال في الصحراء وقت الغروب مع نخيل', setting: 'desert', time: 'sunset', subjects: ['camel', 'palm'] },
  { id: 'sea-boat', idea: 'مركب شراعي في البحر تحت ضوء القمر بالليل', setting: 'sea', time: 'night', subjects: ['boat'] },
  { id: 'cat-space', idea: 'قطة رائد فضاء بين المجرات', setting: 'space', subjects: ['cat'] },
  { id: 'falcon-mountains', idea: 'صقر يحلق فوق الجبال وقت الفجر', setting: 'mountains', time: 'dawn', subjects: ['falcon'] },
  { id: 'city-night', idea: 'مدينة بالليل تحت المطر', setting: 'city', time: 'night' },
  { id: 'mosque-sunset', idea: 'مسجد وقت الغروب وفانوس', time: 'sunset', subjects: ['mosque', 'lantern'] },
  { id: 'forest-sketch', idea: 'غابة صنوبر في الضباب رسم بالقلم الرصاص', setting: 'forest', look: 'sketch' },
  { id: 'garden-day', idea: 'حديقة ورد في نهار مشمس', setting: 'garden', time: 'day' },
  { id: 'english-desert', idea: 'a camel caravan crossing desert dunes at sunset', setting: 'desert', time: 'sunset', subjects: ['camel'] },
  { id: 'english-bottle', idea: 'a perfume bottle floating in space among the stars', setting: 'space', subjects: ['bottle'] },
  { id: 'english-sea', idea: 'a sailing boat on the sea at night under the moon', setting: 'sea', time: 'night', subjects: ['boat'] },
  { id: 'watercolor-mountains', idea: 'جبال وقت الفجر بألوان مائية', setting: 'mountains', time: 'dawn', look: 'watercolor' },
  // المرحلة التانية: الخيال والجرافيك.
  { id: 'horse-desert', idea: 'حصان عربي يجري في الصحراء', setting: 'desert', subjects: ['horse'], extras: ['light rays'] },
  { id: 'dragon-castle', idea: 'تنين ينفث النار فوق قلعة بالليل', time: 'night', subjects: ['dragon', 'castle'], extras: ['milky way'] },
  { id: 'pyramids-sunset', idea: 'الاهرامات وقت الغروب مع جمال', setting: 'desert', time: 'sunset', subjects: ['pyramid', 'camel'] },
  { id: 'floating-islands', idea: 'جزر طائرة وشلال في عالم خيالي', subjects: ['island', 'waterfall'], not: ['falcon'], extras: ['glowing dust'] },
  { id: 'lighthouse-night', idea: 'فنار على البحر بالليل', setting: 'sea', time: 'night', subjects: ['lighthouse'] },
  { id: 'balloons', idea: 'مناطيد ملونة فوق الجبال', setting: 'mountains', subjects: ['balloon'] },
  { id: 'flying-whale', idea: 'حوت يطير في السما فوق مدينة في حلم', setting: 'city', subjects: ['whale'], not: ['falcon'], extras: ['floating islands'] },
  { id: 'magic-tree', idea: 'شجرة سحرية في حديقة بالليل', setting: 'garden', time: 'night', subjects: ['tree'], extras: ['giant moon', 'fireflies'] },
  { id: 'crystal', idea: 'كريستال بنفسجي', setting: 'studio', subjects: ['crystal'] },
  { id: 'aurora-forest', idea: 'غابة بالليل مع شفق قطبي', setting: 'forest', time: 'night', extras: ['aurora', 'milky way'] },
  { id: 'butterflies', idea: 'فراشات في حديقة ورد وقت الغروب', setting: 'garden', time: 'sunset', subjects: ['butterfly', 'rose'] },
  { id: 'saturn', idea: 'كوكب زحل بحلقاته', setting: 'space', subjects: ['planet'], extras: ['planets'] },
  { id: 'imagination-word', idea: 'صورة تخيلية لجبال وقت الفجر', setting: 'mountains', time: 'dawn', subjects: ['island', 'waterfall'], not: ['horse'], guessed: ['wonder'] },
  { id: 'english-dragon', idea: 'a dragon flying over snowy mountains at night', setting: 'mountains', time: 'night', subjects: ['dragon'] },
  { id: 'english-castle', idea: 'a fantasy castle with a waterfall at sunset', time: 'sunset', subjects: ['castle', 'waterfall'], extras: ['floating islands'] },
  // المرحلة التالتة: التخمين — أفكار ما بتسمّيش مكان ولا عنصر (مناسبة، فصل، إحساس، نوتة عطر).
  { id: 'guess-ramadan', idea: 'صورة عن رمضان', time: 'night', subjects: ['mosque', 'lantern'], guessed: ['ramadan'] },
  { id: 'guess-eid', idea: 'تهنئة بمناسبة العيد', subjects: ['mosque', 'balloon'], guessed: ['eid'] },
  { id: 'guess-egypt', idea: 'صورة تعبر عن مصر', setting: 'desert', subjects: ['pyramid', 'palm'], guessed: ['egypt'] },
  { id: 'guess-oud', idea: 'إحساس العود والبخور', setting: 'studio', subjects: ['bottle'], guessed: ['oud'] },
  { id: 'guess-fresh', idea: 'عطر منعش للصيف', subjects: ['bottle'], setting: 'sea', time: 'day', guessed: ['fresh scent'] },
  { id: 'guess-winter', idea: 'إحساس الشتاء', setting: 'mountains', guessed: ['winter'] },
  { id: 'guess-spring', idea: 'الربيع', setting: 'garden', subjects: ['rose', 'butterfly'], guessed: ['spring'] },
  { id: 'guess-autumn', idea: 'جو الخريف', setting: 'forest', time: 'sunset', guessed: ['autumn'] },
  { id: 'guess-romance', idea: 'صورة رومانسية', setting: 'garden', time: 'sunset', subjects: ['rose'], guessed: ['romance'] },
  { id: 'guess-calm', idea: 'صورة تدي إحساس بالهدوء', setting: 'sea', time: 'dawn', guessed: ['calm'] },
  { id: 'guess-fear', idea: 'مشهد مرعب', setting: 'forest', time: 'night', subjects: ['castle'], guessed: ['fear'] },
  { id: 'guess-freedom', idea: 'الحرية', setting: 'mountains', subjects: ['falcon'], guessed: ['freedom'] },
  { id: 'guess-legend', idea: 'مشهد أسطوري', time: 'night', subjects: ['dragon', 'castle'], guessed: ['legend'] },
  { id: 'guess-luxury', idea: 'تصميم فخم', setting: 'studio', subjects: ['bottle'], guessed: ['luxury'] },
  { id: 'guess-english', idea: 'a calm peaceful picture', setting: 'sea', time: 'dawn', guessed: ['calm'] },
  { id: 'guess-yields-to-words', idea: 'جمل في الصحراء في الشتاء بالليل', setting: 'desert', time: 'night', subjects: ['camel'], not: ['falcon', 'bottle'] },
  { id: 'guess-arabian-horse', idea: 'حصان عربي', setting: 'desert', subjects: ['horse'], not: ['camel'] },
  { id: 'guess-arabian-perfume', idea: 'عطر عربي', setting: 'desert', time: 'sunset', subjects: ['bottle'], not: ['camel'] },
  { id: 'stars-desert', idea: 'صحراء تحت النجوم', setting: 'desert', time: 'night' },
  { id: 'stars-alone', idea: 'نجوم', setting: 'space' },
  { id: 'no-false-calm', idea: 'زخرفة اسلامية على مسجد', subjects: ['mosque'], not: ['boat'] },
  { id: 'no-false-hope', idea: 'قمر كامل فوق البحر', setting: 'sea', time: 'night', not: ['tree'] },
  { id: 'count-horses', idea: 'ثلاث احصنة في الصحراء', setting: 'desert', subjects: ['horse'] },
  // الدروس الجاية: حاجات المرسم لسه ما يعرفش يرسمها ولازم يعترف بكده.
  { id: 'gap-car', idea: 'سيارة رياضية حمراء في المدينة', beyond: true },
  { id: 'gap-lion', idea: 'أسد واقف على صخرة وقت الغروب', beyond: true },
  { id: 'gap-robot', idea: 'روبوت في مدينة بالليل', beyond: true },
  { id: 'gap-portrait', idea: 'بورتريه واقعي لوجه رجل عجوز', beyond: true },
  { id: 'gap-food', idea: 'طبق كشري مصري على ترابيزة', beyond: true },
  { id: 'gap-english-dog', idea: 'a dog playing in the garden', beyond: true },
];

/**
 * «التمرين المكثّف» — every thing the painter knows, in every place, at every time of day, in Arabic and in
 * English: each sentence must come back with exactly the thing, the place and the time it names.
 */
const PLACES: [PaintSetting, string, string][] = [['space', 'في الفضاء', 'in space'], ['desert', 'في الصحراء', 'in the desert'], ['sea', 'على البحر', 'by the sea'], ['mountains', 'فوق الجبال', 'over the mountains'], ['forest', 'في الغابة', 'in the forest'], ['city', 'في المدينة', 'in the city'], ['garden', 'في حديقة', 'in a garden'], ['studio', 'على رخام', 'on marble']];
const HOURS: [PaintTime, string, string][] = [['night', 'بالليل', 'at night'], ['sunset', 'وقت الغروب', 'at sunset'], ['dawn', 'وقت الفجر', 'at dawn'], ['day', 'في النهار', 'in daylight']];
const THINGS: [PaintSubject, string, string][] = [
  ['bottle', 'زجاجة عطر', 'a perfume bottle'], ['dragon', 'تنين', 'a dragon'], ['horse', 'حصان', 'a horse'], ['whale', 'حوت', 'a whale'], ['rose', 'ورد', 'roses'], ['falcon', 'صقر', 'a falcon'],
  ['cat', 'قطة', 'a cat'], ['camel', 'جمل', 'a camel'], ['palm', 'نخيل', 'palms'], ['lantern', 'فانوس', 'a lantern'], ['mosque', 'مسجد', 'a mosque'], ['boat', 'مركب', 'a boat'], ['figure', 'رجل', 'a man'],
  ['pyramid', 'اهرامات', 'pyramids'], ['castle', 'قلعة', 'a castle'], ['lighthouse', 'فنار', 'a lighthouse'], ['balloon', 'منطاد', 'a balloon'], ['island', 'جزر طائرة', 'floating islands'],
  ['waterfall', 'شلال', 'a waterfall'], ['planet', 'كوكب', 'a planet'], ['crystal', 'كريستال', 'a crystal'], ['butterfly', 'فراشات', 'butterflies'], ['tree', 'شجرة', 'a tree'],
];
export function drillLessons(): PaintLesson[] {
  const out: PaintLesson[] = [];
  for (const [subject, ar, en] of THINGS) for (const [setting, placeAr, placeEn] of PLACES) for (const [time, hourAr, hourEn] of HOURS) {
    const expected = setting === 'space' ? 'night' : time; // space has no time of day
    out.push({ id: `drill-ar-${subject}-${setting}-${time}`, idea: `${ar} ${placeAr} ${hourAr}`, setting, time: expected, subjects: [subject], only: true });
    out.push({ id: `drill-en-${subject}-${setting}-${time}`, idea: `${en} ${placeEn} ${hourEn}`, setting, time: expected, subjects: [subject], only: true });
  }
  return out;
}
