/**
 * «مقياس الكلام الطبيعي»: how much a spoken reply sounds like talk and not like a page read aloud.
 * Used by the conversation drills (scripts/talk-drill.ts) and their tests — never shown to visitors.
 *   - page leftovers (titles, bullets, tables, links, emoji) and digits in Arabic (they must be said as words);
 *   - written openers («بالتأكيد!»، «إليك…»، «فيما يلي») and written words in a colloquial dialect («لدينا»، «يمكنك»، «سوف»);
 *   - sentences longer than a breath, a turn longer than a listener holds, more than one question at once;
 *   - context: the thing he was asked about («الأرخص فيهم؟») must be named in the answer.
 * 100 = natural; 90 and over counts as natural (one written word at most, no page leftovers).
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';

export interface TalkScore { score: number; natural: boolean; issues: string[] }

const PAGE = /[#*|•_`[\]{}<>]|https?:|^\s*\d+[.)]\s|\n\s*[-–]\s/mu;
const EMOJI = /[\p{Extended_Pictographic}]/u;
const OPENERS = /^(?:بالتأكيد|بالتاكيد|بكل تأكيد|بكل سرور|سؤال (?:رائع|ممتاز|جميل)|يسعدني|يسرني|إليك|اليك|فيما يلي|Sure!|Certainly|Absolutely|Great question|Here (?:are|is))/iu;
/** Written words nobody says in a colloquial talk (whole words). */
const WRITTEN: Record<'egyptian' | 'white', string[]> = {
  egyptian: ['لدينا', 'لديك', 'لدي', 'يمكنك', 'بإمكانك', 'إليك', 'فيما يلي', 'سوف', 'هل', 'ذلك', 'هذا', 'هذه', 'الذي', 'التي', 'لذلك', 'لذا', 'حيث', 'إذا', 'اذا',
    'عندما', 'ماذا', 'لماذا', 'كيف', 'أين', 'الآن', 'جداً', 'المزيد', 'يتميز', 'تتميز', 'يحتوي', 'تحتوي', 'نقدم', 'نوفر', 'تستطيع', 'ليس', 'ليست', 'أريد', 'تريد',
    'جيد', 'جيدة', 'أيضاً', 'أيضا', 'فقط', 'لكن', 'ولكن', 'مثل', 'طويلاً', 'تدريجياً', 'جيداً', 'يدوم', 'تدوم', 'يستغرق', 'تستغرق', 'تبلغ', 'يبلغ',
    'إلى', 'يعتبر', 'تعتبر', 'قم', 'اتركه', 'أضف', 'سنتواصل', 'سوف', 'تضع', 'فوراً', 'تجنب', 'وبس'],
  white: ['لدينا', 'لديك', 'لدي', 'يمكنك', 'بإمكانك', 'إليك', 'فيما يلي', 'سوف', 'هل', 'لذلك', 'لذا', 'حيث', 'ماذا', 'لماذا', 'المزيد', 'يحتوي', 'تحتوي',
    'نقدم', 'نوفر', 'تستطيع', 'ذلك', 'تضع', 'جيداً', 'تدريجياً', 'يستغرق', 'تبلغ', 'يعتبر', 'قم', 'اتركه', 'أضف'],
};
/** Written connectors and set phrases — not said in any dialect's talk (MSA talk included). */
const WRITTEN_ALL = ['فإن', 'بينما', 'من حيث', 'في الختام', 'علاوة على ذلك', 'بالإضافة إلى ذلك', 'بما يلي', 'ما يلي', 'يُنصح', 'ينصح', 'نتفهم', 'انزعاجك', 'يرجى', 'يُرجى',
  'سيتم', 'يتم', 'لم يتم', 'وفقاً', 'يوماً', 'لا يمكن', 'نحن', 'تماماً', 'وبالتالي', 'حيث إن', 'كما أن', 'إضافة إلى', 'ومن ثم', 'مما يجعل', 'الجدير بالذكر', 'لا سيما'];
const wordRe = (w: string) => [w, new RegExp(`(?<![\\p{L}\\p{M}])(?:و|ف)?${w}(?![\\p{L}\\p{M}])`, 'u')] as const;
const WRITTEN_RE = Object.fromEntries(Object.entries(WRITTEN).map(([k, words]) => [k, [...words, ...WRITTEN_ALL].map(wordRe)])) as Record<'egyptian' | 'white', Array<readonly [string, RegExp]>>;
const WRITTEN_MSA = WRITTEN_ALL.map(wordRe);
const EN_WRITTEN = /\b(?:furthermore|moreover|additionally|in conclusion|as follows|the following)\b/iu;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function talkScore(said: string, { language, dialect, refer, maxWords = 100 }: {
  language: SupportedLanguage; dialect?: Dialect;
  /** A name the answer must say (context: «الأرخص فيهم؟» → the product's name). */
  refer?: string;
  maxWords?: number;
}): TalkScore {
  const issues: string[] = [];
  let score = 100;
  const hit = (points: number, why: string) => { score -= points; issues.push(why); };
  const text = said.trim();
  if (!text) return { score: 0, natural: false, issues: ['فاضي'] };
  if (PAGE.test(text)) hit(30, 'بقايا تنسيق صفحة');
  if (EMOJI.test(text)) hit(10, 'إيموجي');
  if (language === 'ar' && /\d/u.test(text)) hit(15, 'أرقام مكتوبة مش متقالة');
  if (OPENERS.test(text)) hit(20, 'افتتاحية كتابة');
  if (language === 'ar') {
    const table = dialect === 'msa' ? WRITTEN_MSA : !dialect || dialect === 'egyptian' ? WRITTEN_RE.egyptian : WRITTEN_RE.white;
    const found = table.filter(([, re]) => re.test(text)).map(([w]) => w);
    if (found.length) hit(Math.min(40, found.length * 8), `كلام مكتوب: ${found.join('، ')}`);
  }
  if (language === 'en' && EN_WRITTEN.test(text)) hit(10, 'written English');
  if (language !== 'ar' && language !== 'fa' && /،/u.test(text)) hit(10, 'فاصلة عربي في كلام أجنبي');
  if (/^(?:(?:بص|شوف|بصراحة|طيب|So|Well|Honestly)[،,]\s*)?(?:وكمان|وبعد|وفي الآخر|وفي الأخير|Also|Plus)[،,]/u.test(text)) hit(10, 'بداية بحرف ربط');
  // «بص، نعتذر…»: a casual opener before an apology sounds careless.
  if (/^(?:بص|بصراحة|شوف|طيب|So|Well|Honestly)[،,]\s*(?:نعتذر|نأسف|آسف|اسف|آسفين|معلش|حقك علينا|sorry|we apologi[sz]e|I'm sorry|I am sorry)/iu.test(text)) hit(15, 'افتتاحية قبل اعتذار');
  const sentences = text.split(/(?<=[.!?؟…])\s+/u).filter(Boolean);
  const long = sentences.filter((s) => words(s) > 26).length;
  if (long) hit(Math.min(20, long * 10), `${long} جملة أطول من نفَس`);
  if (words(text) > maxWords) hit(15, `طويل (${words(text)} كلمة)`);
  const questions = (text.match(/[?؟]/gu) || []).length;
  if (questions > 1) hit(Math.min(15, (questions - 1) * 5), `${questions} أسئلة مرة واحدة`);
  if (refer && !text.includes(refer)) hit(25, `ما ذكرش «${refer}»`);
  score = Math.max(0, score);
  return { score, natural: score >= 90, issues };
}
