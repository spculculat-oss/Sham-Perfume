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

/* ───────────────────── «فهم احتياج الزائر»: what he needs right now, from his own words ───────────────────── */

/**
 * Read from the words the person just wrote — nothing stored, no profile, no guess about who he is.
 * It only changes HOW the same honest answer is given (shorter, simpler, more detailed, calmer, more decisive).
 */
export type VisitorNeed = 'disagrees' | 'hurried' | 'detail' | 'simple' | 'upset' | 'undecided';
const flat = (text: string) => text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
const NEED_WORDS: [VisitorNeed, RegExp][] = [
  // He objects to what was said: checked first, because «انت غلطان» is a discussion, not a complaint.
  ['disagrees', /انت غلطان|انتي غلطانه|كلامك غلط|ده مش صح|دا مش صح|مش صحيح|غير صحيح|مش مقتنع|مش موافق|اختلف معاك|مين قال كده|ايه دليلك|ايه الدليل|you'?re wrong|you are wrong|that'?s (?:not true|wrong|incorrect)|i disagree|i don'?t agree|not convinced|says who|what'?s your (?:evidence|source|proof)/],
  ['upset', /زهقت|تعبت منك|مش شغال|مش نافع|برضه غلط|لسه غلط|تاني غلط|قلتلك|مش ده اللي|ما فهمتنيش|مفهمتنيش|!{3,}|\bstill (?:not|wrong|broken)\b|doesn'?t work|not working|i (?:already )?told you|that'?s not what|frustrat|useless/],
  ['hurried', /مستعجل|بسرعه|باختصار|في سطر|في كلمتين|من غير شرح|الخلاصه|عالسريع|\bquick(?:ly)?\b|\bbrief(?:ly)?\b|in short|tl;?dr|one line|just the answer|no explanation/],
  ['detail', /بالتفصيل|تفصيلي|خطوه خطوه|خطوه بخطوه|اشرح اكتر|وضح اكتر|كل التفاصيل|شرح كامل|in detail|step by step|more detail|elaborate|thorough|deep dive|walk me through/],
  ['simple', /مبتدئ|مش فاهم|مش فاهمه|ببساطه|بطريقه سهله|بشكل مبسط|يعني ايه|لطفل|كاني طفل|beginner|i don'?t understand|in simple (?:terms|words)|explain like|eli5|for dummies|what does .{1,40} mean/],
  ['undecided', /محتار|محتاره|مش عارف اختار|مش عارفه اختار|انهي احسن|ايهما افضل|ايه الاحسن|اختار ايه|تنصحني ب|متردد|can'?t decide|which (?:one )?(?:is|would be) (?:better|best)|which should i|what would you (?:pick|choose|recommend)|torn between/],
];
export function readNeed(message: string): VisitorNeed | undefined {
  const text = flat(message);
  if (text.length > 1500) return undefined; // a pasted document, not a way of asking
  return NEED_WORDS.find(([, words]) => words.test(text))?.[0];
}
export const NEED_HINT: Record<VisitorNeed, string> = {
  disagrees: 'الشخص معترض على كلامك: راجع النقطة من أولها بجد قبل ما ترد. لو هو صح قول «عندك حق» وصحّح الغلط بوضوح. لو كلامك هو الصح اثبت عليه بهدوء وبالدليل ووضّح نقطة الخلاف بالظبط — ما توافقش علشان ترضيه وما تعاندش علشان تكسب. ولو الموضوع فيه أكتر من رأي معتبر أو إنت مش متأكد، قول كده صراحة.',
  hurried: 'الشخص مستعجل: الإجابة نفسها في سطر أو اتنين، من غير مقدمة ولا شرح زيادة، ولو في خطوة واحدة مهمة قولها.',
  detail: 'الشخص طالب تفاصيل: اشرح خطوة خطوة بترتيب واضح، بمثال حقيقي، ومن غير ما تقفز على خطوة.',
  simple: 'الشخص عايز تبسيط: كلمات سهلة من غير مصطلحات، تشبيه أو مثال من الحياة، وفكرة واحدة في كل جملة.',
  upset: 'الشخص متضايق من رد سابق: جملة واحدة قصيرة تعترف بالمشكلة من غير تبرير، وبعدها الحل المحدد على طول. ما تكررش اللي اتقال قبل كده.',
  undecided: 'الشخص محتار بين اختيارات: رشّح اختيار واحد واضح بسببه الحقيقي، واذكر بديل واحد وإمتى يبقى أنسب. ما ترصّش كل الاحتمالات وتسيبه محتار، وما تضغطش عليه.',
};
/** The line added to the instructions for this turn ('' when his words ask for nothing special). */
export function needInstruction(message: string, { answered = true }: { answered?: boolean } = {}): string {
  // A correction is the most important thing to understand in this turn (before his mood) — after an answer only.
  const focus = answered ? correctionFocus(message) : undefined;
  if (focus) return correctionInstruction(focus);
  const need = readNeed(message);
  return need ? `\n${NEED_HINT[need]}` : '';
}

/* ───────────────────── «التدقيق في المطلوب»: answer what was asked, exactly ───────────────────── */

/**
 * «لا أنا ما بتكلمش عن كده، أنا بقولك…» (the owner, 2026-11-16): the visitor corrects what Shaheen understood. The
 * last answer missed; the question meant is the one after «بقولك / قصدي / I mean» (or the whole message).
 */
export function correctionFocus(message: string): string | undefined {
  const text = flat(message).replace(/\s+/g, ' ').trim();
  if (text.length > 1500) return undefined;
  const correcting = /(?:^|\s)(?:مش|ما|م)\s*(?:ب|بت)?(?:تكلم|اتكلم|كلمتك|اقصد|قصدي|سالت|سالتك|بسال|بسالك)(?:ش)?\s*(?:عن|علي|في)?\s*(?:كده|كدا|ده|دا|دي|ذلك|هذا|الموضوع ده)?|مش (?:ده|دا|دي|كده|كدا) (?:قصدي|اللي (?:انا )?(?:بسال|سالت|عايزه|قصدته|بقوله))|مش ده سؤالي|فهمتني غلط|فهمت غلط|مفهمتنيش|ما فهمتنيش|انت مش فاهمني|(?:^|\s)(?:انا|انت)?\s*بقول ?لك(?!\s*(?:ايه|اي|حاجه))|(?:^|\s)قصدي|(?:^|\s)سؤالي (?:هو|كان)|\bi(?:'m| am) not (?:talking|asking) about\b|\bthat'?s not what i (?:meant|asked|mean)\b|\bnot what i (?:meant|asked)\b|\byou misunderstood\b|\bi mean\b|\bwhat i(?:'m| am) asking is\b/.test(text);
  if (!correcting) return undefined;
  // The question meant: what follows the last «بقولك / قصدي / سؤالي / I mean …» — or the whole message.
  const marker = /(?:بقول ?لك(?!\s*(?:ايه|اي|حاجه))|قصدي|سؤالي (?:هو|كان)|اللي (?:انا )?بساله|\bi mean\b|\bwhat i(?:'m| am) asking is\b|\bmy question (?:is|was)\b)\s*(?:ان|إن|هو|is|that)?\s*/gi;
  let last = -1; let end = 0;
  for (const m of message.matchAll(new RegExp(marker.source.replace(/ا/g, '[اأإآ]'), 'giu'))) { last = m.index!; end = m.index! + m[0].length; }
  const after = last >= 0 ? message.slice(end).trim() : '';
  return (after.length >= 8 ? after : message.trim()).slice(0, 600);
}

/** The line for a correcting turn: drop what was misunderstood, answer the question meant — and only it. */
export function correctionInstruction(focus: string): string {
  return `\nالشخص بيصحح فهمك لسؤاله: ردك اللي فات ماكانش على المقصود. ماتكررش اللي قلته وماتطوّلش في الاعتذار (كلمة زي «تمام، فهمتك» كفاية). السؤال المقصود بالظبط: «${focus.replace(/[«»]/g, '"')}». حدّد إيه الفرق بينه وبين اللي فهمته غلط، وجاوب عليه هو بس: لو سؤال «هل…؟» ابدأ بالإجابة الصريحة (أيوه / لأ / جزئياً) في أول سطر وبعدها السبب، واهتم بكل قيد فيه (زي «بالشكل اللي موجود حالياً»، «بالظبط»، فترة زمنية أو مكان).`;
}

/**
 * «زوّد التدقيق في الإجابة»: every answer starts from what was really asked — the kind of question and every limit
 * in it — and never drifts to a nearby, more general subject.
 */
export const PRECISE_ANSWER_INSTRUCTION = `\nقبل ما ترد: حدّد السؤال بالظبط — نوعه (هل؟ / إمتى؟ / ليه؟ / إزاي؟ / مقارنة / رأي) وكل قيد فيه (زمن، مكان، «زي اللي موجود حالياً»، «بالظبط»، كمية) — وجاوب عليه هو مش على موضوع قريب منه أو أعم. سؤال «هل…؟» يبدأ بالإجابة الصريحة في أول سطر. فرّق بين المفاهيم القريبة (مثلاً «العطور عند الفراعنة» مش هي «صناعة العطور الحديثة بالكحول والتقطير»). لو السؤال له معنيين حقيقيين ومش واضح أنهي، اسأل سؤال توضيح واحد قصير بدل ما تخمّن.`;
