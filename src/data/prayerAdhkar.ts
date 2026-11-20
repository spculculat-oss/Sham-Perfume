import type { LText } from '../لغات/localize';

export const HISN_AL_MUSLIM_URL = 'https://islamhouse.com/read/ar/حصن-المسلم-من-أذكار-الكتاب-والسنة-2522';
export const ADHKAR_CATEGORIES = {
  morning: { ar: 'الصباح', en: 'Morning' }, evening: { ar: 'المساء', en: 'Evening' },
  prayer: { ar: 'الصلاة والأذان', en: 'Prayer & adhan' }, sleep: { ar: 'النوم والاستيقاظ', en: 'Sleep & waking' },
  home: { ar: 'البيت واللباس', en: 'Home & clothing' }, wudu: { ar: 'الوضوء والخلاء', en: 'Wudu & restroom' },
  mosque: { ar: 'المسجد', en: 'Mosque' }, food: { ar: 'الطعام والصيام', en: 'Meals & fasting' },
  travel: { ar: 'السفر والنزول', en: 'Travel & stopping' },
  general: { ar: 'الذكر والاستغفار', en: 'Dhikr & forgiveness' }, needs: { ar: 'الحاجات والأحوال', en: 'Daily situations' },
} satisfies Record<string, LText>;
export type AdhkarCategory = keyof typeof ADHKAR_CATEGORIES;
type Source = { label: LText; url: string };
export interface Dhikr {
  id: string;
  categories: readonly AdhkarCategory[];
  title: LText;
  text?: string;
  verses?: readonly string[];
  source: Source;
  repeat?: number;
}
const collections = {
  bukhari: ['صحيح البخاري', 'Sahih al-Bukhari'], muslim: ['صحيح مسلم', 'Sahih Muslim'],
  abudawud: ['سنن أبي داود', 'Sunan Abi Dawud'], tirmidhi: ['جامع الترمذي', 'Jamiʿ at-Tirmidhi'],
  nasai: ['سنن النسائي', 'Sunan an-Nasa’i'], ibnmajah: ['سنن ابن ماجه', 'Sunan Ibn Majah'],
} as const;
const source = (book: keyof typeof collections, num: string | number): Source => ({
  label: { ar: `${collections[book][0]} · ${num}`, en: `${collections[book][1]} · ${num}` }, url: `https://sunnah.com/${book}:${num}`,
});
const dhikr = (id: string, categories: readonly AdhkarCategory[], ar: string, en: string, text: string, ref: Source, repeat?: number): Dhikr => ({
  id, categories, title: { ar, en }, text, source: ref, ...(repeat !== undefined ? { repeat } : {}),
});
const verses = (id: string, categories: readonly AdhkarCategory[], ar: string, en: string, sura: number, start: number, end: number, ref: Source, repeat?: number): Dhikr => ({
  id, categories, title: { ar, en }, verses: Array.from({ length: end - start + 1 }, (_, i) => `${sura}:${start + i}`), source: ref, ...(repeat !== undefined ? { repeat } : {}),
});
const daily = ['morning', 'evening'] as const;
const tawhid = 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.';

// Original topical selection of Arabic invocations from classical sources.
// See docs/PRAYER_TOOLS.md for provenance and the complete book link; not a modern edition or translation.
export const ADHKAR: readonly Dhikr[] = [
  dhikr('morning-domain', ['morning'], 'أصبحنا وأصبح الملك لله', 'At the start of the day', 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ. رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.', source('muslim', '2723a')),
  dhikr('evening-domain', ['evening'], 'أمسينا وأمسى الملك لله', 'At the start of the night', 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا. رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ.', source('muslim', '2723a')),
  dhikr('morning-by-you', ['morning'], 'اللهم بك أصبحنا', 'By You we enter the morning', 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.', source('abudawud', 5068)),
  dhikr('evening-by-you', ['evening'], 'اللهم بك أمسينا', 'By You we enter the evening', 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.', source('tirmidhi', 3391)),
  dhikr('sayyid', [...daily, 'general'], 'سيّد الاستغفار', 'Master supplication for forgiveness', 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.', source('bukhari', 6306)),
  dhikr('no-harm', daily, 'بسم الله الذي لا يضر', 'In the name of Allah: protection from harm', 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.', source('abudawud', 5088), 3),
  dhikr('afiyah', daily, 'سؤال العفو والعافية', 'Asking for pardon and well-being', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي. اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي. اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي، وَعَنْ يَمِينِي وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي.', source('abudawud', 5074)),
  dhikr('unseen', [...daily, 'sleep'], 'عالم الغيب والشهادة', 'Knower of the unseen and seen', 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ.', source('abudawud', 5067)),
  dhikr('praise-daily', daily, 'سبحان الله وبحمده', 'Glorify Allah and praise Him', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.', source('muslim', '2692'), 100),
  verses('ikhlas', daily, 'سورة الإخلاص', 'Surah Al-Ikhlas', 112, 1, 4, source('abudawud', 5082), 3),
  verses('falaq', daily, 'سورة الفلق', 'Surah Al-Falaq', 113, 1, 5, source('abudawud', 5082), 3),
  verses('nas', daily, 'سورة الناس', 'Surah An-Nas', 114, 1, 6, source('abudawud', 5082), 3),
  dhikr('evening-shelter', ['evening', 'travel'], 'أعوذ بكلمات الله التامات', 'Take refuge in Allah’s perfect words', 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.', source('muslim', '2709a')),
  dhikr('after-adhan', ['prayer'], 'الدعاء بعد الأذان', 'Supplication after adhan', 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ.', source('bukhari', 614)),
  dhikr('after-salah-ask', ['prayer'], 'الاستغفار بعد الصلاة', 'Seek forgiveness after prayer', 'أَسْتَغْفِرُ اللَّهَ.', source('muslim', 591), 3),
  dhikr('after-salah-peace', ['prayer'], 'اللهم أنت السلام', 'You are Peace', 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ.', source('muslim', 591)),
  dhikr('after-salah-give', ['prayer'], 'اللهم لا مانع لما أعطيت', 'None can withhold what You give', `${tawhid} اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ.`, source('bukhari', 844)),
  dhikr('after-salah-subhan', ['prayer'], 'التسبيح بعد الصلاة', 'Glorification after prayer', 'سُبْحَانَ اللَّهِ.', source('muslim', 597), 33),
  dhikr('after-salah-hamd', ['prayer'], 'التحميد بعد الصلاة', 'Praise after prayer', 'الْحَمْدُ لِلَّهِ.', source('muslim', 597), 33),
  dhikr('after-salah-takbir', ['prayer'], 'التكبير بعد الصلاة', 'Takbir after prayer', 'اللَّهُ أَكْبَرُ.', source('muslim', 597), 33),
  dhikr('after-salah-complete', ['prayer'], 'ختام التسبيح بعد الصلاة', 'Complete the remembrance after prayer', tawhid, source('muslim', 597)),
  dhikr('sleep-name', ['sleep'], 'باسمك اللهم أموت وأحيا', 'In Your name I die and live', 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.', source('bukhari', 6324)),
  dhikr('wake-praise', ['sleep'], 'الحمد لله الذي أحيانا', 'Praise upon waking', 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ.', source('bukhari', 6324)),
  verses('kursi', ['sleep'], 'آية الكرسي قبل النوم', 'Ayat al-Kursi before sleep', 2, 255, 255, source('bukhari', 2311)),
  verses('baqarah-end', ['sleep'], 'آخر آيتين من سورة البقرة', 'Last two verses of Al-Baqarah', 2, 285, 286, source('bukhari', 5009)),
  dhikr('sleep-surrender', ['sleep'], 'أسلمت نفسي إليك', 'Entrusting oneself to Allah before sleep', 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ.', source('bukhari', 6313)),
  dhikr('wearing', ['home'], 'ذكر لبس الثوب', 'Putting on clothing', 'الْحَمْدُ لِلَّهِ الَّذِي كَسَانِي هَذَا الثَّوْبَ وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ.', source('abudawud', 4023)),
  dhikr('leave-home', ['home'], 'الخروج من البيت', 'Leaving home', 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.', source('abudawud', 5095)),
  dhikr('enter-home', ['home'], 'ذكر الله عند دخول البيت', 'Remember Allah when entering home', 'بِسْمِ اللَّهِ.', source('muslim', '2018a')),
  dhikr('enter-restroom', ['wudu'], 'دخول الخلاء', 'Entering the restroom', 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ.', source('bukhari', 142)),
  dhikr('leave-restroom', ['wudu'], 'الخروج من الخلاء', 'Leaving the restroom', 'غُفْرَانَكَ.', source('abudawud', 30)),
  dhikr('after-wudu', ['wudu'], 'بعد الوضوء', 'After wudu', 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ.', source('muslim', '234a')),
  dhikr('enter-mosque', ['mosque'], 'دخول المسجد', 'Entering the mosque', 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ.', source('muslim', 713)),
  dhikr('leave-mosque', ['mosque'], 'الخروج من المسجد', 'Leaving the mosque', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ.', source('muslim', 713)),
  dhikr('before-food', ['food'], 'قبل الأكل', 'Before eating', 'بِسْمِ اللَّهِ.', source('bukhari', 5376)),
  dhikr('remember-food', ['food'], 'لو نسيت التسمية قبل الأكل', 'If you forgot to mention Allah before eating', 'بِسْمِ اللَّهِ فِي أَوَّلِهِ وَآخِرِهِ.', source('abudawud', 3767)),
  dhikr('after-food', ['food'], 'الحمد بعد الأكل', 'Praise after eating', 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ.', source('tirmidhi', 3458)),
  dhikr('iftar', ['food'], 'عند الإفطار من الصيام', 'When breaking the fast', 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ، وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ.', source('abudawud', 2357)),
  verses('ride', ['travel'], 'آيتان من سورة الزخرف', 'Two verses from Surah Az-Zukhruf', 43, 13, 14, source('muslim', 1342)),
  dhikr('travel', ['travel'], 'دعاء السفر', 'Supplication for travel', 'اللَّهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى. اللَّهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا، وَاطْوِ عَنَّا بُعْدَهُ. اللَّهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ وَالْخَلِيفَةُ فِي الْأَهْلِ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ وَكَآبَةِ الْمَنْظَرِ وَسُوءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ.', source('muslim', 1342)),
  dhikr('tawhid', ['general'], 'التهليل', 'Declaration of oneness', tawhid, source('bukhari', 6403), 100),
  dhikr('two-phrases', ['general'], 'كلمتان خفيفتان على اللسان', 'Two phrases light on the tongue', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ.', source('bukhari', 6406)),
  dhikr('treasure', ['general'], 'لا حول ولا قوة إلا بالله', 'There is no power nor strength except through Allah', 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.', source('bukhari', 6384)),
  dhikr('repentance', ['general'], 'الاستغفار والتوبة', 'Seeking forgiveness and repenting', 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ.', source('bukhari', 6307)),
  dhikr('anxiety', ['needs'], 'الهم والحزن', 'Anxiety and sorrow', 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ.', source('bukhari', 6369)),
  dhikr('distress', ['needs'], 'دعاء الكرب', 'Supplication in distress', 'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ.', source('bukhari', 6346)),
  dhikr('rain', ['needs'], 'عند نزول المطر', 'When it rains', 'اللَّهُمَّ صَيِّبًا نَافِعًا.', source('bukhari', 1032)),
  dhikr('after-rain', ['needs'], 'بعد المطر', 'After rain', 'مُطِرْنَا بِفَضْلِ اللَّهِ وَرَحْمَتِهِ.', source('bukhari', 846)),
  dhikr('illness', ['needs'], 'الدعاء للمريض', 'Supplication for someone ill', 'أَذْهِبِ الْبَاسَ رَبَّ النَّاسِ، وَاشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا.', source('bukhari', 5750)),
  dhikr('sneeze', ['needs'], 'ذكر العطاس', 'Remembrance when sneezing', 'الْحَمْدُ لِلَّهِ.', source('bukhari', 6224)),
];
