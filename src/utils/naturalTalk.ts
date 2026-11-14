/**
 * «سلاسة الكلام»: how Shaheen's reply reads and how it arrives on screen. One module for both chats
 * (the workspace and the store chat), with no network and no AI call:
 *   - NATURAL_TALK_INSTRUCTION: the talking manners every platform is told to follow;
 *   - polishReply: removes the robotic opener or closer a platform adds anyway;
 *   - streamSafe: what may be shown of a reply that is still arriving (no half-written technical block);
 *   - revealStep: the steady pace letters appear at, whatever bursts the network delivers.
 */

export const NATURAL_TALK_INSTRUCTION = `سلاسة الكلام: اتكلم زي إنسان فاهم بيرد على صاحبه، مش زي منشور رسمي.
- ابدأ بالإجابة نفسها من أول كلمة. ممنوع افتتاحيات الحشو («بالتأكيد!»، «بالطبع!»، «سؤال رائع»، «إليك»، «فيما يلي»، «يسعدني مساعدتك») وممنوع تعيد صياغة السؤال.
- طول الرد على قد السؤال: سؤال بسيط = جملة لتلات جمل؛ الشرح والخطوات والمقارنات تاخد مساحتها. ما تطوّلش علشان تبان شامل.
- جمل قصيرة مترابطة بتسلّم لبعض (علشان كده، يعني، بس، وبعدين)، وكل فقرة فكرة واحدة. نوّع بدايات الجمل وما تكررش نفس الكلمة أو نفس القالب في كل رد.
- النقاط والعناوين والجداول للحاجات اللي فعلاً قايمة أو خطوات أو مقارنة؛ الكلام العادي يتكتب فقرات عادية. ما تبالغش في الخط العريض ولا الإيموجي.
- كمّل على اللي اتقال قبل كده من غير ما تعيده، وافتكر اسم الشخص وتفضيلاته لو قالها.
- اقفل لما الإجابة تخلص. ممنوع خواتيم الحشو («أتمنى أن يكون هذا مفيداً»، «لا تتردد في السؤال»، «هل تريد المزيد؟»)؛ سؤال المتابعة يتسأل بس لو فعلاً هيفرق في الإجابة.
- لو الشخص متضايق أو مستعجل أو بيهزر، جاريه في نبرته بهدوء واحترام.`;

const OPENERS: RegExp[] = [
  /^(?:سؤال|استفسار)\s+(?:رائع|ممتاز|جميل|مهم|جيد|وجيه)(?:\s+جد[اً]+)?\s*[!.،:…]+\s*/u,
  /^(?:بالتأكيد|بالطبع|بكل سرور|بكل تأكيد)\s*[!.،:…]+\s*(?=(?:إليك|اليك|إليكِ|سأ|يمكنني|يسعدني|هذه|هذا|هنا|تفضل|دي|ده|دول|فيما)\S*)/u,
  /^يسعدني\s+(?:جد[اً]+\s+)?(?:مساعدتك|أن أساعدك|ان اساعدك)[^.!؟\n]{0,40}[!.…]+\s*/u,
  /^(?:great|good|excellent|interesting|that'?s an? (?:great|good|excellent|interesting)) question\s*[!.,:…]+\s*/i,
  /^(?:certainly|sure|of course|absolutely|definitely)\s*[!.,:…]+\s*(?=(?:here|i['’ ]|let me|below)\b)/i,
  /^as an ai(?: language model| assistant)?\s*,\s*/i,
  /^i(?:'d| would) be (?:happy|glad|delighted) to help[^.!?\n]{0,40}[!.…]+\s*/i,
];
const CLOSERS: RegExp[] = [
  /(?:^|\n|(?<=[.!?؟…])\s)\s*(?:أتمنى|اتمنى|آمل|أرجو)\s+(?:أن\s+)?(?:يكون|تكون)[^.!؟\n]{0,60}(?:مفيد|مفيدة|مفيداً|واضح|واضحة|ساعد)[^.!؟\n]{0,30}[.!…]*\s*$/u,
  /(?:^|\n|(?<=[.!?؟…])\s)\s*(?:و)?(?:لا تتردد|لا تترددي|ما تترددش)[^.!؟\n]{0,90}[.!…]*\s*$/u,
  /(?:^|\n|(?<=[.!?؟…])\s)\s*(?:و)?(?:إذا|اذا|لو)\s+(?:كان|كانت)?\s*(?:لديك|عندك)\s+(?:أي|اي)\s+(?:أسئلة|اسئلة|استفسار|استفسارات|سؤال)[^.!؟\n]{0,90}[.!…]*\s*$/u,
  /(?:^|\n|(?<=[.!?؟…])\s)\s*i hope (?:this|that) helps[^.!?\n]{0,40}[.!…]*\s*$/i,
  /(?:^|\n|(?<=[.!?؟…])\s)\s*(?:feel free to|don'?t hesitate to|let me know if you (?:have|need|want|would like))[^.!?\n]{0,110}[.!…]*\s*$/i,
];

/** Drops a filler opener / closer. Never touches the middle of a reply, a technical block, or a reply too short to lose a sentence. */
export function polishReply(text: string): string {
  let out = text;
  const lead = out.match(/^\s*/)![0];
  let body = out.slice(lead.length);
  for (let round = 0; round < 2; round += 1) {
    const hit = OPENERS.find((re) => re.test(body));
    if (!hit) break;
    const rest = body.replace(hit, '');
    if (rest.trim().length < 12) break; // the opener was the whole answer
    body = rest;
  }
  out = lead + body;
  if (!/```\s*$/.test(out)) {
    for (const re of CLOSERS) {
      const rest = out.replace(re, '');
      if (rest !== out && rest.trim().length >= 40) { out = rest.replace(/\s+$/, ''); break; }
    }
  }
  return out;
}

const HIDDEN_FENCE = /```\s*sham-[a-z]*[^\n]*\n[\s\S]*$/i;
/**
 * The part of a still-arriving reply that is fit to show: a half-written Shaheen block (picture, media, video,
 * formula request) is held back until it closes, and so is a fence marker or a link that is cut in the middle.
 */
export function streamSafe(partial: string): string {
  let out = partial;
  // An open sham-* block: complete ones are handled by the page; an unfinished one is never shown raw.
  const fences = [...out.matchAll(/```/g)];
  if (fences.length % 2 === 1) {
    const open = fences[fences.length - 1]!.index!;
    const tail = out.slice(open);
    if (HIDDEN_FENCE.test(tail) || /^```\s*(?:s(?:h(?:a(?:m(?:-[a-z]*)?)?)?)?)?$/i.test(tail)) out = out.slice(0, open);
  }
  out = out.replace(/(?<!`)`{1,2}$/, '');                              // a fence marker being typed
  out = out.replace(/\[[^\]\n]{0,120}\]\([^)\s]{0,300}$/, '');    // a link whose address is still arriving
  out = out.replace(/\[[^\]\n]{0,120}$/, (m) => (/^\[\d{0,2}$/.test(m) ? '' : m)); // a citation number «[1» cut in two
  out = out.replace(/\s+$/, '').replace(/(?:^|\s)(?:[*_#>|-]{1,3}|\d{1,2}[.)])$/, '');               // list / bold / heading marker with nothing after it yet
  return out.replace(/\s+$/, '');
}

export interface RevealOptions {
  /** Letters per second when keeping up. */
  rate?: number;
  /** The reply has fully arrived: finish quickly. */
  done?: boolean;
  /** Seconds in which whatever is waiting should be on screen (default: 0.9 while arriving, 0.45 once done). */
  drainSec?: number;
}
/**
 * How many characters of `target` to show after `dtMs` more milliseconds, given `shown` are on screen.
 * A steady reading pace; it speeds up smoothly when text piles up (never more than about a second behind) and
 * stops only at the end of a word, so no word is seen being built letter by letter in the middle.
 */
export function revealStep(shown: number, target: string, dtMs: number, { rate = 55, done = false, drainSec }: RevealOptions = {}): number {
  const total = target.length;
  if (shown >= total) return total;
  const backlog = total - shown;
  const speed = Math.max(rate, backlog / (drainSec ?? (done ? 0.45 : 0.9))); // chars per second
  let next = Math.min(total, shown + Math.max(1, Math.round((speed * Math.max(0, dtMs)) / 1000)));
  if (next >= total) return total;
  // Finish the word (and never split a surrogate pair or leave a combining mark behind).
  const limit = Math.min(total, next + 24);
  while (next < limit && !/\s/u.test(target[next]!)) next += 1;
  if (next < total && /[\uDC00-\uDFFF]/.test(target[next]!)) next += 1;
  return next;
}
