import type { LText } from '../لغات/localize';

interface ListeningLink {
  title: LText;
  publisher: LText;
  url: string;
  year?: number;
}

interface ListeningGroup {
  id: 'makkah' | 'madinah' | 'hagia-sophia' | 'reciters';
  title: LText;
  links: readonly ListeningLink[];
}

const islamWeb = { ar: 'إسلام ويب', en: 'IslamWeb' };
const assabile = { ar: 'السبيل', en: 'Assabile' };

// Publisher/player pages for listeners. These are not audio URLs, embeds or licensed reminder presets.
export const ADHAN_LISTENING_GROUPS: readonly ListeningGroup[] = [
  {
    id: 'makkah',
    title: { ar: 'الحرم المكي', en: 'The Grand Mosque · Makkah' },
    links: [
      { title: { ar: 'علي بن أحمد ملا', en: 'Ali ibn Ahmad Mulla' }, url: 'https://audio.islamweb.net/audio/info/3', publisher: islamWeb },
      { title: { ar: 'تسجيلات من الحرم المكي', en: 'Recordings from Masjid al-Haram' }, url: 'https://ar.assabile.com/adhan-call-prayer/makkah', publisher: assabile },
    ],
  },
  {
    id: 'madinah',
    title: { ar: 'المسجد النبوي', en: 'The Prophet’s Mosque · Madinah' },
    links: [
      { title: { ar: 'عصام بخاري', en: 'Issam Bukhari' }, url: 'https://audio.islamweb.net/audio/info/5', publisher: islamWeb },
      { title: { ar: 'تسجيلات من الحرم المدني', en: 'Recordings from Masjid an-Nabawi' }, url: 'https://ar.assabile.com/adhan-call-prayer/madinah', publisher: assabile },
    ],
  },
  {
    id: 'hagia-sophia',
    title: { ar: 'مسجد آيا صوفيا', en: 'Hagia Sophia Mosque · Istanbul' },
    links: [
      { title: { ar: 'أذان الجمعة يوم إعادة الافتتاح', en: 'Friday adhan at the reopening' }, url: 'https://www.youtube.com/watch?v=Ayj5R2ll73Y', year: 2020, publisher: { ar: 'سي إن إن التركية · فيديو', en: 'CNN Türk · video' } },
      { title: { ar: 'أذان الفجر من آيا صوفيا', en: 'Fajr adhan from Hagia Sophia' }, url: 'https://www.diyanet.tv/bereket-vakti-ayasofya-2017/video/ayasofyada-sabah-ezani', year: 2017, publisher: { ar: 'قناة ديانت التركية · فيديو', en: 'Diyanet TV · video' } },
    ],
  },
  {
    id: 'reciters',
    title: { ar: 'مشاهير القرّاء', en: 'Well-known reciters' },
    links: [
      { title: { ar: 'محمد رفعت', en: 'Muhammad Rifaat' }, url: 'https://audio.islamweb.net/audio/info/122665', publisher: islamWeb },
      { title: { ar: 'عبد الباسط عبد الصمد', en: 'Abdul Basit Abdus Samad' }, url: 'https://audio.islamweb.com/audio/info/197594', publisher: islamWeb },
      { title: { ar: 'عبد الباسط عبد الصمد · أذان الفجر', en: 'Abdul Basit Abdus Samad · Fajr adhan' }, url: 'https://audio.islamweb.net/audio/info/404627', publisher: islamWeb },
      { title: { ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary' }, url: 'https://audio.islamweb.net/audio/info/122667', publisher: islamWeb },
      { title: { ar: 'محمد صديق المنشاوي', en: 'Muhammad Siddiq Al-Minshawi' }, url: 'https://audio.islamweb.net/audio/info/88639', publisher: islamWeb },
      { title: { ar: 'مصطفى إسماعيل', en: 'Mustafa Ismail' }, url: 'https://audio.islamweb.net/audio/info/176760', publisher: islamWeb },
      { title: { ar: 'مشاري راشد العفاسي', en: 'Mishary Rashid Alafasy' }, url: 'https://misharialafasy.net/azan', publisher: { ar: 'موقع العفاسي', en: 'Alafasy’s website' } },
      { title: { ar: 'المزيد من أصوات الأذان', en: 'More adhan voices' }, url: 'https://www.assabile.com/adhan-call-prayer', publisher: assabile },
    ],
  },
];
