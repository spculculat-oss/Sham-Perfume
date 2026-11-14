/**
 * «بنك تدريب مرسم شاهين» — the ideas the painter is trained on. `known` ideas must come out with the right
 * place, time and subjects; `beyond` ideas are honest gaps: the painter must admit them (`missing`) instead of
 * drawing something else. Teaching a new subject = move its idea from `beyond` to `known` after adding it to
 * src/utils/shaheenPainter.ts.
 */
import type { PaintSetting, PaintSubject, PaintTime, PaintLook } from '../../src/utils/shaheenPainter';

export interface PaintLesson { id: string; idea: string; setting?: PaintSetting; time?: PaintTime; subjects?: PaintSubject[]; look?: PaintLook; extras?: string[]; not?: PaintSubject[]; beyond?: true }

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
  { id: 'imagination-word', idea: 'صورة تخيلية لجبال وقت الفجر', setting: 'mountains', time: 'dawn', not: ['horse'], extras: ['floating islands'] },
  { id: 'english-dragon', idea: 'a dragon flying over snowy mountains at night', setting: 'mountains', time: 'night', subjects: ['dragon'] },
  { id: 'english-castle', idea: 'a fantasy castle with a waterfall at sunset', time: 'sunset', subjects: ['castle', 'waterfall'], extras: ['floating islands'] },
  // الدروس الجاية: حاجات المرسم لسه ما يعرفش يرسمها ولازم يعترف بكده.
  { id: 'gap-car', idea: 'سيارة رياضية حمراء في المدينة', beyond: true },
  { id: 'gap-lion', idea: 'أسد واقف على صخرة وقت الغروب', beyond: true },
  { id: 'gap-robot', idea: 'روبوت في مدينة بالليل', beyond: true },
  { id: 'gap-portrait', idea: 'بورتريه واقعي لوجه رجل عجوز', beyond: true },
  { id: 'gap-food', idea: 'طبق كشري مصري على ترابيزة', beyond: true },
  { id: 'gap-english-dog', idea: 'a dog playing in the garden', beyond: true },
];
