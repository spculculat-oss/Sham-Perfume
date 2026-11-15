/**
 * «عقل شاهين» — how Shaheen understands a question, orders his thoughts and checks his answer before it is sent.
 * One module for every chat (the workspace, the store chat, the owner's room), with no network and no AI call:
 *
 *   - THINKING_CRAFT_INSTRUCTION: the habits of a careful expert (understand → plan → answer → check), always on;
 *   - profileQuestion: what kind of question this is (comparison, steps, debate, code, plan, explanation, creative,
 *     feelings, quick fact), how deep it goes and whether it is too vague to answer without one question back;
 *   - thinkingHint: the shape that kind of answer should take, added for this one turn only;
 *   - reviewReply: a checklist run on the finished reply (language, structure, repetition, a cut-off end, an open
 *     code block…). Small slips are mended here (fixReply); real ones send the reply back for one rewrite in
 *     «فكّر بعمق» mode (revisionRequest);
 *   - DEEP_PLAN_INSTRUCTION: the private outline written first in «فكّر بعمق» mode.
 *
 * None of this pretends to be a bigger model: it makes the platform that answers follow the working method of the
 * best assistants — and it is measured by tests/thinkingCraft.test.ts.
 */

export const THINKING_CRAFT_INSTRUCTION = `طريقة التفكير (زي الخبير الشاطر، من غير ما تكتب الخطوات دي في ردك):
1) افهم قبل ما ترد: إيه اللي الشخص عايزه فعلاً، وإيه الهدف اللي ورا السؤال، وإيه اللي اتقال قبل كده في المحادثة. لو في كلمة غلط في الكتابة افهمها من السياق.
2) لو الطلب مش واضح ويحتمل أكتر من معنى مهم: اسأل سؤال توضيحي واحد قصير، أو قول افتراضك في جملة وكمّل عليه. ما تخمّنش في حاجة مهمة (فلوس، صحة، قانون، كود هيتنفّذ).
3) رتّب أفكارك قبل الكتابة: الإجابة المباشرة الأول، وبعدها التفاصيل بالترتيب المنطقي (من الأهم للأقل، أو من البسيط للصعب)، وكل فقرة فكرة واحدة.
4) فكّر خطوة بخطوة في المسائل الصعبة (حسابات، منطق، كود، قرارات): اتأكد من كل خطوة، وراجع الأرقام والوحدات، وجرّب الحل على مثال.
5) في النقاش: اعرض أقوى حجة لكل رأي بأمانة، وبعدين قول رأيك بوضوح وليه، ودرجة ثقتك فيه، ورحّب إن الشخص يعترض. لو الشخص غلطان قوله بلطف وبالدليل، ولو هو صح وإنت كنت غلطان اعترف وصحّح.
6) الصدق أهم من إنك تبان عارف: فرّق بين اللي متأكد منه واللي استنتاج، وقول «مش متأكد» لما الدليل مش كفاية، وما تخترعش أرقام أو مصادر أو أحداث.
7) قبل ما تبعت راجع ردك: جاوب على كل جزء في السؤال؟ في تناقض أو تكرار؟ اللغة نفس لغة الشخص؟ الكود كامل وشغّال؟ لو لا، صلّح.`;

export type QuestionKind = 'compare' | 'howto' | 'debate' | 'code' | 'plan' | 'explain' | 'creative' | 'feelings' | 'quick' | 'general';

export interface QuestionProfile {
  kind: QuestionKind;
  /** Several questions in one message, or a long detailed request. */
  deep: boolean;
  /** How many separate questions were asked (each deserves its own answer). */
  questions: number;
  /** Too short and too open to answer well without one question back (only when there is no earlier context). */
  vague: boolean;
  /** The language family of the question, to check the answer against. */
  script: 'arabic' | 'latin' | 'other';
}

/** Letters only, Arabic folded (hamzas, ta marbuta, alef maqsura, diacritics), lower case. */
export function foldText(text: string): string {
  return text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
}

/** Which script most letters of a text are written in (code blocks left out). */
export function scriptOf(text: string): QuestionProfile['script'] {
  const plain = text.replace(/```[\s\S]*?(?:```|$)/g, ' ').replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const arabic = (plain.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (plain.match(/[A-Za-z]/g) || []).length;
  const other = (plain.match(/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g) || []).length;
  if (arabic >= latin && arabic >= other && arabic > 0) return 'arabic';
  if (other > latin) return 'other';
  return 'latin';
}

/**
 * Arabic stems match at the start of a word (after an optional و/ف/ب and ال), never inside another word — `\b`
 * does not work next to Arabic letters. Stems are written folded (ة → ه, أ → ا, ى → ي).
 */
const arabicWords = (stems: string[], whole = false) =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:[وفب])?(?:ال)?(?:${stems.join('|')})${whole ? '(?![\\p{L}\\p{M}])' : ''}`, 'u');

const KIND_RULES: [QuestionKind, RegExp, RegExp][] = [
  ['feelings', arabicWords(['زعلان', 'متضايق', 'مخنوق', 'قلقان', 'خايف', 'مكتئب', 'حزين', 'محبط', 'وحيد', 'مضغوط', 'مش قادر استحمل', 'تعبان نفسيا']),
    /\b(?:i(?:'m| am) (?:so )?(?:sad|depressed|anxious|stressed|lonely|scared|worried|overwhelmed)|i feel (?:so )?(?:sad|down|lost|anxious|lonely|hopeless))\b/],
  ['code', arabicWords(['كود', 'برمج', 'بايثون', 'جافا ?سكريبت', 'داله', 'فانكشن', 'ايرور', 'باج', 'سكريبت', 'ري ?اكت', 'رياكت', 'قاعده بيانات', 'استعلام']),
    /```|\b(?:code|coding|function|bug|error|exception|stack ?trace|script|javascript|typescript|python|react|vue|node(?:\.js)?|sql|api|regex|css|html|compile|debug|refactor|deploy|git)\b/],
  // «أحسن X ولا Y؟» counts as a comparison even with words between «أحسن» and «ولا».
  ['compare', new RegExp(`${arabicWords(['الفرق بين', 'فرق بين', 'الفرق ما بين', 'مقارنه', 'قارن', 'احسن ولا', 'افضل ام', 'افضل ولا', 'ولا احسن', 'ايهما', 'اي واحد احسن', 'انهي احسن', 'انهو احسن', 'انهي افضل']).source}|(?<![\\p{L}\\p{M}])(?:احسن|افضل|اجمد|ارخص|اغلي)(?![\\p{L}\\p{M}])[^؟?\\n]{1,60}\\s(?:ولا|ام|او)\\s`, 'u'),
    /\b(?:vs\.?|versus|compare|comparison|difference between|which is better|better than)\b/],
  ['debate', arabicWords(['رايك', 'تفتكر', 'بتفتكر', 'ناقش', 'نتناقش', 'مع ولا ضد', 'مع او ضد', 'صح ولا غلط', 'مميزات وعيوب', 'ايجابيات وسلبيات', 'المفروض اعمل', 'المفروض عمل', 'اعمل ايه', 'اختار ايه', 'انصحني', 'تنصحني']),
    /\b(?:what do you think|your opinion|do you agree|debate|argue|should i|is it (?:right|wrong|worth)|pros and cons|advantages and disadvantages)\b/],
  ['plan', arabicWords(['خطه', 'جدول', 'استراتيجيه', 'روتين', 'برنامج تدريب', 'برنامج دراسه', 'برنامج غذائي', 'رود ?ماب']),
    /\b(?:plan|roadmap|strategy|schedule|routine|timeline|business plan)\b/],
  ['howto', arabicWords(['ازاي', 'ازي', 'كيف', 'كيفيه', 'طريقه', 'خطوات', 'علمني']),
    /\b(?:how (?:to|do|can|should)|steps to|guide|tutorial|walk me through|set up|install)\b/],
  ['creative', arabicWords(['اكتبلي', 'اكتب لي', 'اكتب قصه', 'اكتب شعر', 'اكتب قصيده', 'اكتب مقال', 'اكتب اعلان', 'اكتب بوست', 'اكتب كابشن', 'اكتب رساله', 'اكتب خطاب', 'اكتب سيناريو', 'اكتب اغنيه', 'الف قصه', 'قصه عن']),
    /\b(?:write (?:a|an|me) (?:short )?(?:story|poem|song|essay|ad|post|caption|letter|script|speech)|brainstorm|slogan|tagline)\b/],
  ['explain', arabicWords(['اشرح', 'يعني ايه', 'ما هو', 'ما هي', 'ما معني', 'معني', 'ليه', 'لماذا', 'عرفني', 'ايه هو', 'ايه هي', 'فهمني'], true),
    /\b(?:explain|what is|what are|what does|why|meaning of|define|tell me about|how does .+ work)\b/],
];
const QUICK_START = new RegExp(`^(?:${['مين', 'امتي', 'فين', 'كام', 'كم', 'هل', 'متي', 'اين'].join('|')})(?![\\p{L}\\p{M}])|^(?:who|when|where|how many|how much|is|are|does|did)\\b`, 'u');

/** Reads what kind of answer a message asks for. `hasContext`: there is an earlier conversation to lean on. */
export function profileQuestion(text: string, hasContext = false): QuestionProfile {
  const raw = text.trim();
  const q = foldText(raw);
  const questions = Math.max(1, (raw.match(/[?؟]/g) || []).length);
  const words = q.split(/\s+/).filter(Boolean).length;
  let kind: QuestionKind = 'general';
  for (const [k, ar, en] of KIND_RULES) if (ar.test(q) || en.test(q)) { kind = k; break; }
  if (kind === 'general' && words <= 12 && questions === 1 && (/[?؟]/.test(q) || QUICK_START.test(q))) kind = 'quick';
  const deep = questions >= 2 || raw.length > 700 || (kind !== 'quick' && words > 60);
  // «ساعدني» or «عندي مشكلة» with nothing else and nothing before it: one question back beats a guess.
  const vague = !hasContext && words <= 3 && !/```/.test(raw) && /^(?:ساعدني|ساعدنى|عايز مساعده|محتاج مساعده|عندي مشكله|عندى مشكله|سؤال|عندي سؤال|ممكن سؤال|سؤال صغير|عايز حاجه|عاوز حاجه|محتاج حاجه|عندي حاجه|في حاجه|فيه حاجه|عايز اسالك|help|help me|i need help|question|i have a problem|problem)[\s.!?؟]*$/.test(q);
  return { kind, deep, questions, vague, script: scriptOf(raw) };
}

const HINTS: Record<QuestionKind, string> = {
  compare: 'نوع السؤال: مقارنة. اعرض المقارنة في جدول Markdown (المعايير في الصفوف)، وبعده خلاصة واضحة: تختار إيه وإمتى، حسب احتياج الشخص لو تعرفه.',
  howto: 'نوع السؤال: طريقة عمل. اكتب خطوات مرقّمة بالترتيب، كل خطوة فعل واضح، وقبلها اللي محتاجه يكون جاهز لو في، وبعدها أشهر غلطة لازم يتجنبها.',
  debate: 'نوع السؤال: نقاش ورأي. اعرض أقوى حجج كل رأي بأمانة، وبعدين رأيك أنت بوضوح وسببه ودرجة ثقتك، واختم بسؤال واحد يفتح النقاش أو يوضح ظروفه.',
  code: 'نوع السؤال: برمجة. افهم المشكلة أو المطلوب الأول، اشرح السبب أو الفكرة في سطرين، واكتب الكود كامل وشغّال (مش أجزاء ولا «باقي الكود زي ما هو»)، وبعده إزاي يجرّبه وأهم حالة حدّية.',
  plan: 'نوع السؤال: خطة. قسّمها مراحل ليها هدف واضح ومدة تقريبية، وفي كل مرحلة خطوات عملية، وفي الآخر إزاي يقيس إنه نجح وأهم مخاطرة وحلها.',
  explain: 'نوع السؤال: شرح. ابدأ بتعريف بسيط في جملة، بعدها تشبيه أو مثال من الحياة يقرّب الفكرة، وبعدين التفاصيل الأعمق للي عايز يكمّل.',
  creative: 'نوع السؤال: كتابة إبداعية. ابدأ بجملة تشد، والتزم بالنبرة والطول المطلوبين، ونوّع الصور والكلمات. لو القطعة قصيرة (عنوان، كابشن، شعار) اقترح من 2 لـ 3 اختيارات مختلفة.',
  feelings: 'الشخص بيتكلم عن مشاعره. ابدأ بتعاطف حقيقي في جملة أو اتنين، من غير نقاط ولا محاضرات، واسأل سؤال واحد لطيف يفهم بيه أكتر. لو في خطر على حياته وجّهه بهدوء لحد يثق فيه أو لمختص فوراً.',
  quick: 'نوع السؤال: سؤال سريع. جاوب في جملة لتلات جمل بالمعلومة نفسها، من غير مقدمات.',
  general: '',
};

/** The shape this one answer should take; an empty string when the general habits are enough. */
export function thinkingHint(profile: QuestionProfile): string {
  const lines = [HINTS[profile.kind]];
  if (profile.questions >= 2) lines.push(`في الرسالة ${profile.questions} أسئلة: جاوب على كل واحد فيهم بالترتيب، وكل إجابة تحت رقمها أو عنوانها.`);
  else if (profile.deep && profile.kind !== 'feelings') lines.push('الطلب طويل ومفصّل: رتّب ردك بعناوين قصيرة (##) علشان يتقري بسهولة، وغطّي كل نقطة فيه.');
  if (profile.vague) lines.push('الرسالة قصيرة ومفتوحة ومفيش كلام قبلها: اسأل سؤال توضيحي واحد قصير يحدد المطلوب، واقترح اختيارين أو تلاتة يختار منهم.');
  return lines.filter(Boolean).join('\n');
}

// ── The check before sending ────────────────────────────────────────────────────────────────────────────────
export type ReviewSeverity = 'fix' | 'revise';
export interface ReviewNote { id: string; severity: ReviewSeverity; ar: string }

const fenceCount = (text: string) => (text.match(/^\s*```/gm) || []).length;
const outsideCode = (text: string) => text.replace(/```[\s\S]*?(?:```|$)/g, ' ');

/** A loop of the same four words (a platform stuck repeating itself). */
export function repeats(text: string): boolean {
  const words = outsideCode(text).trim().split(/\s+/);
  if (words.length < 24) return false;
  const seen = new Map<string, number>();
  for (let i = 0; i <= words.length - 4; i++) {
    const gram = words.slice(i, i + 4).join(' ').toLowerCase();
    const n = (seen.get(gram) || 0) + 1;
    if (n >= 4) return true;
    seen.set(gram, n);
  }
  return false;
}

/** A long reply that stops in the middle of a sentence (cut by a length limit). */
export function cutOff(text: string): boolean {
  const t = text.trimEnd();
  if (t.length < 400) return false;
  if (fenceCount(t) % 2 === 1) return true;
  const last = t.split('\n').pop()!.trim();
  if (/^\|.*\|$/.test(last) || /^```/.test(last) || /^[-*•]\s|^\d+[.)]\s/.test(last)) return false;
  return !/[.!?؟…:)\]»"'*_`\p{Extended_Pictographic}]$/u.test(last);
}

/**
 * The checklist on a finished reply. `fix` notes are mended in place by fixReply; `revise` notes mean the reply
 * should be rewritten (only done in «فكّر بعمق» mode, where a second pass is affordable).
 */
export function reviewReply(question: string, reply: string, profile: QuestionProfile = profileQuestion(question)): ReviewNote[] {
  const notes: ReviewNote[] = [];
  const text = reply.trim();
  if (!text) return [{ id: 'empty', severity: 'revise', ar: 'الرد فاضي.' }];
  if (fenceCount(text) % 2 === 1) notes.push({ id: 'open_fence', severity: 'fix', ar: 'سياج كود مفتوح ومتقفلش.' });
  const prose = outsideCode(text);
  const replyScript = scriptOf(text);
  if (profile.script === 'arabic' && replyScript !== 'arabic' && prose.replace(/\s/g, '').length > 80) {
    notes.push({ id: 'language', severity: 'revise', ar: 'السؤال بالعربي والرد مش بالعربي — لازم الرد يبقى بلغة الشخص.' });
  } else if (profile.script === 'latin' && replyScript === 'arabic' && prose.replace(/\s/g, '').length > 80) {
    notes.push({ id: 'language', severity: 'revise', ar: 'السؤال مش بالعربي والرد بالعربي — لازم الرد يبقى بلغة الشخص.' });
  }
  if (repeats(text)) notes.push({ id: 'repeat', severity: 'revise', ar: 'في كلام بيتكرر بنفس الصيغة.' });
  if (cutOff(text)) notes.push({ id: 'cut', severity: 'revise', ar: 'الرد وقف في نص جملة — لازم يكمل ويتقفل.' });
  const structured = /^\s*(?:#{1,4}\s|[-*•]\s|\d+[.)]\s|\|)/m.test(prose);
  if (prose.length > 1400 && !structured && (prose.match(/\n\s*\n/g) || []).length < 2) {
    notes.push({ id: 'wall', severity: 'revise', ar: 'الرد كتلة كلام واحدة طويلة — قسّمه فقرات أو نقاط علشان يتقري.' });
  }
  if (profile.kind === 'compare' && text.length > 350 && !/\|\s*:?-{3,}/.test(text)) {
    notes.push({ id: 'compare_table', severity: 'revise', ar: 'السؤال مقارنة والرد من غير جدول يوضح الفرق.' });
  }
  if (profile.kind === 'howto' && text.length > 400 && !/^\s*(?:\d+[.)]|[-*•])\s/m.test(text)) {
    notes.push({ id: 'steps', severity: 'revise', ar: 'السؤال عن طريقة والرد من غير خطوات مرتبة.' });
  }
  if (profile.kind === 'code' && /\/\/\s*\.\.\.|#\s*\.\.\.\s*$|باقي الكود|بقية الكود|rest of (?:the )?code|existing code/im.test(text)) {
    notes.push({ id: 'partial_code', severity: 'revise', ar: 'الكود ناقص («باقي الكود…») — لازم يتكتب كامل.' });
  }
  if (profile.questions >= 2 && text.length < 160 * profile.questions && !structured) {
    notes.push({ id: 'all_parts', severity: 'revise', ar: `في الرسالة ${profile.questions} أسئلة والرد قصير أوي — اتأكد إنك جاوبت على كل واحد.` });
  }
  return notes;
}

/** Mends what can be mended without rewriting: closes an open code block. */
export function fixReply(reply: string): string {
  let out = reply;
  if (fenceCount(out) % 2 === 1) out = `${out.trimEnd()}\n\`\`\``;
  return out;
}

/** True when the notes call for a second pass. */
export const needsRevision = (notes: ReviewNote[]) => notes.some((n) => n.severity === 'revise');

// ── «فكّر بعمق» ────────────────────────────────────────────────────────────────────────────────────────────
export const DEEP_PLAN_INSTRUCTION = `مهمتك دلوقتي: تفكير داخلي قبل الرد، مش الرد نفسه. الشخص مش هيشوف اللي هتكتبه هنا.
اكتب بإيجاز (نقاط قصيرة، بالعربي أو بلغة السؤال):
- المطلوب الحقيقي: إيه اللي الشخص عايزه، والهدف اللي وراه.
- اللي ممكن يكون مقصود ومش مكتوب، وأي غموض (ولو مهم: السؤال التوضيحي اللي هتسأله).
- الحقائق والمعلومات اللي هتعتمد عليها، ومين فيهم مش متأكد منه.
- خطوات الحل أو الحجج بالترتيب، مع التأكد من الحسابات أو المنطق خطوة خطوة.
- الأخطاء أو الفخاخ اللي لازم تتجنبها.
- شكل الرد الأنسب (فقرة، خطوات، جدول، كود…) وترتيب أقسامه.
ما تكتبش الرد النهائي.`;

/** The private outline is handed to the writer with the question, marked as notes that must not be pasted. */
export function withPlan(question: string, plan: string): string {
  return `${question}\n\n[ملاحظات تفكيرك الداخلي قبل الرد — استخدمها في ترتيب ردك وما تنسخهاش ولا تذكر إنها موجودة]\n${plan.trim().slice(0, 4000)}`;
}

/** The request for one rewrite: the draft, what the check found, and the rules of the rewrite. */
export function revisionRequest(question: string, draft: string, notes: ReviewNote[]): string {
  return [
    `سؤال الشخص:\n${question.slice(0, 6000)}`,
    `مسودة ردك:\n${draft.slice(0, 24_000)}`,
    `المراجعة لقت الملاحظات دي:\n${notes.map((n) => `- ${n.ar}`).join('\n')}`,
    'اكتب الرد النهائي كامل بعد ما تصلح الملاحظات دي، وحافظ على كل المعلومات الصح اللي في المسودة. ما تذكرش المراجعة ولا المسودة، وابدأ بالرد على طول.',
  ].join('\n\n');
}
