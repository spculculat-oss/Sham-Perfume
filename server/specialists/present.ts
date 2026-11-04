/**
 * «عرض الإجابة» — إزاي رد المجلس يوصل للزائر: مقروء، مختصر، ومكتوب عليه مصدره.
 *
 * التنسيق هنا **ثابت ومن غير أي ذكاء اصطناعي** (مايفتحش باب للتخمين في الشكل ولا في المضمون):
 *   · كل رد لازم يكون فيه سطر مصدر — ولو المصدر اللي جاب الرد مانساهوش، `withSource` بتضيفه.
 *   · الرد الطويل بيتقص على آخر سطر كامل، وسطر المصدر يفضل في الآخر دايمًا.
 *   · سطر واحد فاضي بين الفقرات، ومفيش مسافات زيادة في الآخر.
 *
 * أما «الخلاصة في الأول» والمصدر التاني اللي بيزوّد معلومة وحدود المجال الطبي — فدي شغل العقل
 * المدرَّب (src/utils/shaheenAgent.ts: keySentence + decide) وبتيجي جاهزة في الرد.
 */
import { sourceNote, type AnswerSource, type ToolAction } from './tools';

export const PRESENT_LIMITS = { maxChars: 3200, sourceTailChars: 220 };

/** علامات سطر المصدر اللي بتكتبها أدوات المجلس والعقل المدرَّب (إيموجي المصدر أو كلمة «المصدر»). */
const SOURCE_MARK = /(?:🎓|🧠|📚|🧪|🧭|🧮|🛍|📰|🌐|📖|🤖|⏳)|المصدر[:：]|\bSource:\s|\bFrom Shaheen\b|\bFrom the Sham\b/i;

/** هل الرد فيه سطر مصدر فعلاً؟ (قاعدة المنصة: كل رد مكتوب عليه مصدره.) */
export const hasSourceLine = (answer: string): boolean => SOURCE_MARK.test(answer);

/** يضيف سطر مصدر الرد لو ناقص — من غير ما يكرر سطر موجود. */
export function withSource(answer: string, source: AnswerSource, lang: string): string {
  const text = (answer || '').trim();
  if (!text || hasSourceLine(text)) return text;
  return `${text}\n\n_${sourceNote(source, lang)}._`;
}

/**
 * يقص الرد الطويل على آخر سطر كامل (مايقطعش كلمة ولا رقم في النص)، ويخلي سطر المصدر في الآخر:
 * لو القص شال المصدر، بيتكتب من جديد بعد المقص.
 */
export function clipAnswer(answer: string, source: AnswerSource, lang: string, max = PRESENT_LIMITS.maxChars): string {
  const text = (answer || '').trim();
  if (text.length <= max) return text;
  const sourceLine = text.slice(-PRESENT_LIMITS.sourceTailChars);
  const keepSource = hasSourceLine(sourceLine) ? `_${sourceNote(source, lang)}._` : '';
  const body = keepSource ? text.slice(0, text.length - sourceLine.length).trimEnd() : text;
  const cut = body.slice(0, max - keepSource.length - 4).replace(/\s+\S*$/, '').trimEnd();
  return `${cut}…${keepSource ? `\n\n${keepSource}` : ''}`;
}

/** سطر الخطوة الجاية: من الأزرار المتاحة للزائر (مش بديل للأزرار، بس يقول إن فيه خطوة). */
export function nextStep(actions: ToolAction[], lang: string): string {
  const ar = lang !== 'en';
  const tab = actions.find((a) => a.type === 'open_tab');
  const chat = actions.find((a) => a.type === 'open_chat');
  const hand = actions.find((a) => a.type === 'hand_over');
  if (tab) return ar ? `وخطوتك الجاية: افتح «${tab.title || tab.tab}» وجرّب بنفسك.` : `Your next step: open “${tab.title || tab.tab}” and try it yourself.`;
  if (chat) return ar ? `وخطوتك الجاية: كمّل مع «${chat.title || 'الخبير شاهين'}» من الزر اللي تحت الرد.` : `Your next step: continue with ${chat.title || 'Master Shaheen'} from the button below.`;
  if (hand) return ar ? `وخطوتك الجاية: سلّم الطلب لـ«${hand.title || hand.to}» من الزر اللي تحت الرد.` : `Your next step: hand it over to ${hand.title || hand.to} from the button below.`;
  return '';
}

/** سطر المصدر في آخر الرد (لو موجود) — عشان الخطوة الجاية تتكتب قبله، والمصدر يفضل في الآخر. */
const SOURCE_TAIL = /\n\n_[^_]*(?:🎓|🧠|📚|🧪|🧭|🧮|🛍|📰|🌐|📖|🤖|⏳)[^_]*_\s*$/;

/** العرض النهائي للرد: مصدره مكتوب، طوله مظبوط، وخطوته الجاية قبل سطر المصدر (لو فيه خطوة). */
export function present(answer: string, input: { source: AnswerSource; lang: string; actions?: ToolAction[]; step?: boolean; max?: number }): string {
  const clipped = clipAnswer(withSource(answer, input.source, input.lang), input.source, input.lang, input.max ?? PRESENT_LIMITS.maxChars);
  const step = input.step === false ? '' : nextStep(input.actions || [], input.lang);
  if (!step || clipped.includes(step)) return clipped;
  const tail = clipped.match(SOURCE_TAIL);
  if (!tail || tail.index === undefined) return `${clipped}\n\n${step}`;
  return `${clipped.slice(0, tail.index).trimEnd()}\n\n${step}\n\n${tail[0].trim()}`;
}
