/**
 * «مزاج الكلام»: how the visitor sounds in his last sentences — upset, in a hurry, happy, low — and how Shaheen's
 * voice follows it: calmer and slower for someone upset or tired, a little quicker for someone in a hurry, a little
 * brighter for good news. Small nudges on top of the voice, pitch and pace the visitor chose (never a different
 * voice), and only while «يتأقلم مع مزاجك» is on.
 */
import { normalizeArabic } from './arabicDialect';

export type VoiceMood = 'upset' | 'hurried' | 'happy' | 'low' | 'neutral';

const MOOD_WORDS: Record<Exclude<VoiceMood, 'neutral'>, string[]> = {
  upset: ['اتاخر', 'اتأخر', 'متاخر', 'موصلش', 'ماوصلش', 'موصلنيش', 'زهقت', 'زهقتوني', 'وحش', 'غلط', 'مشكله', 'نصب', 'نصابين', 'حرام عليكم', 'ليه كده',
    'مش معقول', 'سيء', 'سيئ', 'زفت', 'مضايق', 'متضايق', 'غضبان', 'شكوى', 'اشتكي', 'فلوسي', 'استرجاع', 'مش راضي', 'خربان', 'مكسور', 'بايظ',
    // The same in the other dialects (Gulf, Levant, Iraq, Maghreb): late, never came, fed up, angry.
    'تاخر', 'تأخر', 'متأخر', 'تعطل', 'تعطلت', 'ما وصل', 'ماوصل', 'ما وصلني', 'ماوصلني', 'ما وصلت', 'ما وصلاتش', 'ماوصلاتش', 'ما جاني', 'ما اجا',
    'عييت', 'طفرت', 'معصب', 'معصبه', 'مقهور', 'مقهوره', 'مقلق', 'زعجتوني', 'مو معقول', 'ماشي معقول', 'غير مقبول', 'مش مقبول', 'مو زين', 'خايس',
    'ضايقتوني', 'نصابه', 'رجعولي فلوسي',
    'late', 'worst', 'terrible', 'angry', 'refund', 'complaint', 'scam', 'broken', 'never arrived', 'ridiculous', 'disappointed'],
  hurried: ['مستعجل', 'مستعجله', 'بسرعه', 'بسرعة', 'عاجل', 'دلوقتي حالا', 'حالا', 'وقتي ضيق', 'مفيش وقت', 'ورايا', 'بسرعه لو سمحت',
    'مزروب', 'مزروبه', 'دغيا', 'على السريع', 'بسرعه عافاك', 'عجل', 'مستعجلين', 'ما عندي وقت', 'ماعندي وقت', 'بدي بسرعه', 'ابيه بسرعه',
    'hurry', 'quickly', 'quick', 'asap', 'in a rush', 'urgent', 'right now'],
  happy: ['تحفه', 'جامد', 'رائع', 'روعه', 'حلو اوي', 'جميل جدا', 'فرحان', 'مبسوط', 'فرحي', 'فرح', 'خطوبتي', 'عيد ميلاد', 'نجحت', 'ممتاز', 'يا سلام',
    'زوين', 'زوينه', 'واو', 'حلو كتير', 'حلو وايد', 'يجنن', 'فرحانه', 'مبسوطه', 'مستانس', 'مستانسه',
    'wow', 'amazing', 'awesome', 'love it', 'great', 'perfect', 'wonderful', 'excited', 'wedding', 'birthday'],
  low: ['تعبان', 'تعبانه', 'زعلان', 'زعلانه', 'حزين', 'حزينه', 'مكتئب', 'وحشني', 'وحشتني', 'عزا', 'الله يرحمه', 'الله يرحمها', 'مريض', 'عيان',
    'تعبانة', 'مهموم', 'ضايج', 'ضايق خلقي', 'مقبوض', 'مدايق',
    'tired', 'sad', 'sick', 'miss him', 'miss her', 'passed away', 'condolences'],
};

/** The mood of the visitor's last sentences (the newest counts most). */
export function moodOf(texts: readonly string[]): VoiceMood {
  const score: Record<VoiceMood, number> = { upset: 0, hurried: 0, happy: 0, low: 0, neutral: 0 };
  texts.slice(-3).forEach((text, i, all) => {
    const weight = i === all.length - 1 ? 2 : 1;
    const padded = ` ${normalizeArabic(text)} `;
    for (const mood of Object.keys(MOOD_WORDS) as Array<Exclude<VoiceMood, 'neutral'>>) {
      for (const word of MOOD_WORDS[mood]) if (padded.includes(` ${normalizeArabic(word)} `)) score[mood] += weight;
    }
    // «!!!» and «؟؟؟»: strong feeling — happy or upset, whichever the words already lean to.
    if (/[!؟?]{2,}/u.test(text)) { if (score.upset >= score.happy && score.upset > 0) score.upset += 1; else if (score.happy > 0) score.happy += 1; }
  });
  // An upset visitor first (a cheerful voice to a complaint is the worst mistake), then a hurry, then low, then happy.
  const order: VoiceMood[] = ['upset', 'hurried', 'low', 'happy'];
  const best = order.reduce((top, mood) => (score[mood] > score[top] ? mood : top), 'neutral' as VoiceMood);
  return score[best] >= 1 ? best : 'neutral';
}

/** How the voice follows the mood: added to the chosen pace and pitch (kept within the engine's comfortable range). */
export function moodTune(mood: VoiceMood): { rate: number; pitch: number } {
  switch (mood) {
    case 'upset': return { rate: -0.08, pitch: -0.06 };
    case 'low': return { rate: -0.07, pitch: -0.04 };
    case 'hurried': return { rate: 0.1, pitch: 0 };
    case 'happy': return { rate: 0.04, pitch: 0.06 };
    default: return { rate: 0, pitch: 0 };
  }
}

/** The pace and pitch to speak with: his choice, nudged by the mood when he wants that. */
export function tunedVoice(choice: { rate: number; pitch: number; mood?: boolean }, texts: readonly string[]): { rate: number; pitch: number; mood: VoiceMood } {
  const mood = choice.mood === false ? 'neutral' : moodOf(texts);
  const tune = moodTune(mood);
  return {
    rate: Math.min(1.35, Math.max(0.65, choice.rate + tune.rate)),
    pitch: Math.min(1.6, Math.max(0.5, choice.pitch + tune.pitch)),
    mood,
  };
}
