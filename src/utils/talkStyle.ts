/**
 * «شاهين بيحكي مش بيقرا»: a written answer (from the AI, his memory, the store or the agent — wherever it came from)
 * re-said the way a perfume expert talks to a customer in front of him, BEFORE numbers and words are put into speech
 * (spokenReply.ts does that next):
 *   - written openers dropped («بالتأكيد!»، «سؤال رائع»، «إليك…:»، «فيما يلي…»);
 *   - a list becomes talk («عندي لك تلات اختيارات: أولهم…، والتاني…، وكمان…»), each item said as a phrase —
 *     «السعر: ٥٠٠ جنيه» → «سعره ٥٠٠ جنيه»، «الثبات: ٨ ساعات» → «ثباته حوالي ٨ ساعات»، «النوتات: عود، ورد» → «فيه عود، ورد»;
 *   - steps are said in order («أول حاجة… وبعدين… وفي الآخر…»);
 *   - titles that only label what follows are not said;
 *   - written verbs said the spoken way («يتميز» → «بيتميز»، «لدينا» → «عندنا»، «يمكنك» → «تقدر»);
 *   - very long sentences cut where people take a breath;
 *   - a natural opener now and then («بص،»، «بصراحة،»، «طيب،») — not on greetings, yes/no answers or questions.
 * Nothing is lost: every item is still said, in order (the long tail waits for «تحب أكمّلك؟»).
 * Pure (no DOM).
 */
import type { SupportedLanguage } from '../types/i18n';
import type { Dialect } from './arabicDialect';
import { removeMediaBlocks } from './mediaBlock';
import { removeFormulaBlocks } from './aiFormulaExtractor';
import { removeToolBlocks } from './shaheenTools';

type Talk = 'egyptian' | 'white' | 'msa' | 'en';
const talkOf = (language: SupportedLanguage, dialect?: Dialect): Talk | undefined =>
  language === 'en' ? 'en' : language !== 'ar' ? undefined : !dialect || dialect === 'egyptian' ? 'egyptian' : dialect === 'msa' ? 'msa' : 'white';

// ── Written openers and fillers that nobody says ────────────────────────────────────────────────────────────
const WRITTEN_OPENERS = [
  /^(?:بالتأكيد|بالتاكيد|بكل تأكيد|بالطبع|طبعاً|طبعا|بكل سرور|بكل سرور!|أكيد)[!،.]?\s*/u,
  /^(?:سؤال|اختيار|سؤالك|فكرة)\s+(?:رائع|رائعة|ممتاز|ممتازة|جميل|جميلة|مهم|حلو|حلوة)(?:\s+(?:جداً|جدا|للغاية))?[!،.]?\s*/u,
  /^(?:يسعدني|يسرني)\s+(?:مساعدتك|أن أساعدك|ان اساعدك|إفادتك)[^.!؟\n]*[.!]?\s*/u,
  /^(?:إليك|اليك|إليكِ|إليكم|فيما يلي|في ما يلي|هذه هي|هذه|هنا)\s+/u,
  /^(?:Sure|Of course|Certainly|Absolutely|Great question|Good question|Happy to help)[!,.]?\s*/iu,
];
/** «Here are the options:» → «I've got a few options:» (dropping «Here are» alone left «the options»). */
const HERE_ARE = /^(?:Here (?:are|is)|Below (?:are|is))\s+(?:(?:the|some)\s+(?=(?:options|choices|picks)\b))?/iu;
const LEAD_EMOJI = /^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u;
const cleanOpening = (line: string) => {
  let out = line.replace(LEAD_EMOJI, '');
  for (let i = 0; i < 3; i += 1) for (const re of WRITTEN_OPENERS) out = out.replace(re, '');
  return out.replace(HERE_ARE, "I've got ").replace(/^I've got (options|choices|picks)/u, "I've got a few $1").trim();
};

// ── «السعر: ٥٠٠ جنيه» → «سعره ٥٠٠ جنيه» ──────────────────────────────────────────────────────────────────────
const LABELS: Array<{ re: RegExp; say: Record<Talk, string> }> = [
  { re: /^(?:السعر|سعره|سعرها|الثمن|price)$/iu, say: { egyptian: 'سعره', white: 'سعره', msa: 'سعره', en: 'it costs' } },
  { re: /^(?:الثبات|ثباته|مدة الثبات|longevity|lasts)$/iu, say: { egyptian: 'ثباته حوالي', white: 'ثباته تقريباً', msa: 'ثباته حوالي', en: 'it lasts about' } },
  { re: /^(?:الفوحان|الفواحية|الانتشار|projection|sillage)$/iu, say: { egyptian: 'فوحانه', white: 'فوحانه', msa: 'انتشاره', en: 'its projection is' } },
  { re: /^(?:الحجم|الحجوم|السعة|المقاس|size)$/iu, say: { egyptian: 'الإزازة', white: 'الحجم', msa: 'الحجم', en: 'the bottle is' } },
  { re: /^(?:النوتات|النوتات العطرية|المكونات|الروائح|الروايح|المكونات الأساسية|notes|ingredients)$/iu, say: { egyptian: 'فيه', white: 'فيه', msa: 'يحتوي على', en: 'it has' } },
  { re: /^(?:النوتات العليا|المقدمة|top notes?)$/iu, say: { egyptian: 'بيفتح بـ', white: 'يفتح بـ', msa: 'يفتتح بـ', en: 'it opens with' } },
  { re: /^(?:قلب العطر|النوتات الوسطى|القلب|heart notes?|middle notes?)$/iu, say: { egyptian: 'وقلبه', white: 'وقلبه', msa: 'وقلبه', en: 'its heart is' } },
  { re: /^(?:القاعدة|النوتات الأساسية|base notes?)$/iu, say: { egyptian: 'وقاعدته', white: 'وقاعدته', msa: 'وقاعدته', en: 'and its base is' } },
  { re: /^(?:مناسب ل|مناسب لـ|يناسب|مناسب|المناسبة|المناسبات|الموسم|الوقت|best for|suitable for)$/iu, say: { egyptian: 'ينفع لـ', white: 'يناسب', msa: 'يناسب', en: "it's good for" } },
  { re: /^(?:النوع|الفئة|العائلة|العائلة العطرية|family|type)$/iu, say: { egyptian: 'نوعه', white: 'نوعه', msa: 'عائلته', en: "it's" } },
  { re: /^(?:الماركة|البراند|الشركة|brand)$/iu, say: { egyptian: 'من', white: 'من', msa: 'من', en: 'by' } },
  { re: /^(?:الشحن|التوصيل|shipping|delivery)$/iu, say: { egyptian: 'الشحن', white: 'الشحن', msa: 'الشحن', en: 'shipping is' } },
  { re: /^(?:ملاحظة|ملحوظة|تنبيه|note)$/iu, say: { egyptian: 'وخلي بالك،', white: 'وانتبه،', msa: 'ولاحظ أن', en: 'and note,' } },
  { re: /^(?:نصيحة|نصيحتي|tip)$/iu, say: { egyptian: 'ونصيحة مني،', white: 'ونصيحة مني،', msa: 'ونصيحتي', en: 'a tip:' } },
  { re: /^(?:التفاصيل|details)$/iu, say: { egyptian: 'والتفاصيل إن', white: 'والتفاصيل إن', msa: 'وبالتفصيل،', en: 'in detail,' } },
  { re: /^(?:الخلاصة|الملخص|باختصار|الإجابة المختصرة|الجواب المختصر|summary|in short|short answer)$/iu, say: { egyptian: 'من الآخر،', white: 'باختصار،', msa: 'باختصار،', en: 'in short,' } },
];
/** «السعر: ٥٠٠» said as a phrase; undefined when the line is not «label: value». */
function labelled(line: string, talk: Talk): string | undefined {
  const m = line.match(/^\s*([^:：]{2,28})\s*[:：]\s*(.+)$/u);
  if (!m) return undefined;
  const label = m[1]!.replace(/\*\*/g, '').trim();
  const rule = LABELS.find(({ re }) => re.test(label));
  if (!rule) return undefined;
  let value = m[2]!.trim();
  if (/(?:حوالي|تقريب|about)\s*$/u.test(rule.say[talk])) value = value.replace(/^(?:حوالي|تقريباً|تقريبا|about|around)\s+/iu, '');
  const lead = rule.say[talk];
  // «ينفع لـ» + «السهرات» → «ينفع للسهرات»; «بيفتح بـ» + «برجموت» → «بيفتح ببرجموت».
  if (/لـ$/u.test(lead)) return `${lead.slice(0, -2)}${/^ال/u.test(value) ? `لل${value.slice(2)}` : `ل${value}`}`;
  if (/بـ$/u.test(lead)) return `${lead.slice(0, -2)}ب${value}`;
  return `${lead} ${value}`;
}

// ── Lists said as talk ───────────────────────────────────────────────────────────────────────────────────────
const COUNT_WORDS: Record<Talk, (n: number) => string> = {
  egyptian: (n) => ({ 2: 'اختيارين', 3: 'تلات اختيارات', 4: 'أربع اختيارات', 5: 'خمس اختيارات' } as Record<number, string>)[n] || `${n} اختيارات`,
  white: (n) => ({ 2: 'خيارين', 3: 'ثلاث خيارات', 4: 'أربع خيارات', 5: 'خمس خيارات' } as Record<number, string>)[n] || `${n} خيارات`,
  msa: (n) => ({ 2: 'خيارين', 3: 'ثلاثة خيارات', 4: 'أربعة خيارات', 5: 'خمسة خيارات' } as Record<number, string>)[n] || `${n} خيارات`,
  en: (n) => `${({ 2: 'two', 3: 'three', 4: 'four', 5: 'five' } as Record<number, string>)[n] || n} options`,
};
const OPTION_LINKS: Record<Talk, string[]> = {
  egyptian: ['أولهم', 'والتاني', 'والتالت', 'والرابع', 'والخامس', 'والسادس', 'والسابع', 'والتامن'],
  white: ['أولها', 'والثاني', 'والثالث', 'والرابع', 'والخامس', 'والسادس', 'والسابع', 'والثامن'],
  msa: ['أولها', 'والثاني', 'والثالث', 'والرابع', 'والخامس', 'والسادس', 'والسابع', 'والثامن'],
  en: ['First,', 'Then', 'Also', 'And', 'Plus', 'And', 'And', 'And'],
};
const STEP_LINKS: Record<Talk, string[]> = {
  egyptian: ['أول حاجة', 'وبعدين', 'وبعد كده', 'وبعدها', 'وبعدين'],
  white: ['أول شي', 'وبعدين', 'وبعد كذا', 'وبعدها', 'وبعدين'],
  msa: ['أولاً', 'ثم', 'وبعد ذلك', 'ثم', 'ثم'],
  en: ['First,', 'then', 'after that,', 'next,', 'then'],
};
const LAST_STEP: Record<Talk, string> = { egyptian: 'وفي الآخر', white: 'وفي الأخير', msa: 'وأخيراً', en: 'and finally,' };
const HAVE: Record<Talk, string> = { egyptian: 'عندي لك', white: 'عندي لك', msa: 'لديّ', en: 'I have' };

interface ListItem { text: string; name?: string }
/** «**بديع العود** — دافي وثابت» → name «بديع العود», rest «دافي وثابت». */
function listItem(raw: string, talk: Talk): ListItem {
  const line = raw.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/u, '').replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1').trim();
  const bold = line.match(/^\*\*([^*]{1,60})\*\*(?:\s*[:：—–-]\s*(.*))?$/u);
  if (bold) return { name: bold[1]!.replace(/[:：]$/u, '').trim(), text: (bold[2] || '').replace(/[.،]\s*(?=و)/gu, '، ').trim() };
  const said = labelled(line, talk);
  if (said) return { text: said };
  const named = line.match(/^([^:：]{2,40})\s*[:：—–]\s+(.+)$/u);
  if (named && !/[.!?؟]/u.test(named[1]!)) return { name: named[1]!.replace(/\*\*/g, '').trim(), text: named[2]!.trim() };
  return { text: line.replace(/\*\*/g, '') };
}
const endSentence = (s: string) => (/[.!?؟…]$/u.test(s) ? s : `${s.replace(/[،,;:]$/u, '')}.`);

/** A block of list lines (with the line that introduced it) said as sentences. */
function sayList(intro: string | undefined, lines: string[], numbered: boolean, talk: Talk): string[] {
  const items = lines.map((line) => listItem(line, talk)).filter((item) => item.text || item.name);
  if (!items.length) return [];
  // A list of facts about ONE thing («السعر: …»، «الثبات: …»): said as one flowing description.
  const facts = items.every((item) => !item.name);
  const out: string[] = [];
  const lead = intro ? cleanOpening(intro).replace(/[:：]\s*$/u, '').trim() : '';
  if (facts && !numbered) {
    const joiner = talk === 'en' ? ', ' : '، و';
    const body = items.map((item) => item.text.replace(/[.،]$/u, '')).join(joiner).replace(/،\s*و(?=و)/u, '، ');
    if (lead && items.length === 1) out.push(endSentence(lead), endSentence(body));
    else out.push(endSentence(lead ? `${lead}${talk === 'en' ? ':' : '،'} ${body}` : body));
    return out;
  }
  if (numbered && facts) {
    // Steps: said in order.
    if (lead) out.push(endSentence(lead));
    items.forEach((item, i) => {
      const link = i === items.length - 1 && i > 0 ? LAST_STEP[talk] : STEP_LINKS[talk][Math.min(i, STEP_LINKS[talk].length - 1)]!;
      out.push(endSentence(`${link} ${item.text.replace(/[.،]$/u, '')}`));
    });
    return out;
  }
  // Options (named items): «عندي لك تلات اختيارات: أولهم X، وده …».
  const count = items.length;
  // «أفضل تلات عطور شتوية:» → «عندي لك أفضل تلات عطور شتوية، أولهم…».
  const ranked = /^(?:أفضل|أحسن|أشهر|أقوى|أجمل|best|top)\s/iu.test(lead) ? `${HAVE[talk]} ${talk === 'en' ? lead.charAt(0).toLowerCase() + lead.slice(1) : lead}` : lead;
  const opening = ranked || (count >= 2 ? `${HAVE[talk]} ${COUNT_WORDS[talk](count)}` : '');
  if (opening) out.push(endSentence(opening).replace(/\.$/u, talk === 'en' ? ':' : '،').replace(/:$/u, '.'));
  items.forEach((item, i) => {
    const link = count >= 2 ? OPTION_LINKS[talk][Math.min(i, OPTION_LINKS[talk].length - 1)]! : '';
    const describe = item.text ? (talk === 'en' ? ` — ${item.text}` : `، ${item.text}`) : '';
    const said = item.name ? `${link} ${item.name}${describe}` : `${link} ${item.text}`;
    out.push(endSentence(said.trim().replace(/\s+/g, ' ')));
  });
  // The opening line and the first option belong together («عندي لك تلات اختيارات، أولهم…»).
  if (opening && out.length >= 2 && /،$/u.test(out[0]!)) out.splice(0, 2, `${out[0]} ${out[1]}`);
  return out;
}

// ── Written verbs and words, said the spoken way ────────────────────────────────────────────────────────────
/** Present-tense verbs that take «بـ» in Egyptian talk («يتميز» → «بيتميز») — not after «ممكن / لازم / عشان…». */
const BI_VERBS = ['يتميز', 'تتميز', 'يناسب', 'تناسب', 'يفوح', 'تفوح', 'يثبت', 'تثبت', 'يتطور', 'يتطوّر', 'يدي', 'يعطي', 'يمنح', 'تمنح', 'يعيش', 'يقعد'];
const NO_BI_AFTER = /(?:^|\s)(?:ممكن|لازم|عشان|علشان|المفروض|يمكن|يجب|قد|لن|لم|أن|ان|كي|لكي|حتى|تقدر|يقدر|عايز|عايزة|هـ|ما|مش|تحب|بدك|تبي)\s*$/u;
const SPOKEN_WORDS: Record<'egyptian' | 'white', Array<[string, string]>> = {
  egyptian: [
    ['يدوم', 'بيقعد'], ['تدوم', 'بتقعد'], ['يستمر', 'بيفضل'], ['يمنحك', 'بيديك'], ['تمنحك', 'بتديك'], ['يعطيك', 'بيديك'],
    ['يتكون من', 'فيه'], ['يحتوي على', 'فيه'], ['تحتوي على', 'فيها'], ['لدينا', 'عندنا'], ['لديك', 'عندك'], ['لدي', 'عندي'], ['لديه', 'عنده'],
    ['نقدم لك', 'عندنا'], ['نوفر لك', 'عندنا'], ['تستطيع', 'تقدر'], ['بإمكانك', 'تقدر'], ['ننصحك', 'أنصحك'], ['نوصي', 'أنصحك'],
    ['إذا', 'لو'], ['اذا', 'لو'], ['عندما', 'لما'], ['حينما', 'لما'], ['مثل', 'زي'], ['أكثر', 'أكتر'], ['اكثر', 'أكتر'], ['كثير', 'كتير'],
    ['قليلاً', 'شوية'], ['قليلا', 'شوية'], ['حقاً', 'بجد'], ['حقا', 'بجد'], ['رائع', 'تحفة'], ['رائعة', 'تحفة'],
    ['ثم', 'وبعدين'], ['يجعلك', 'بيخليك'], ['يجعله', 'بيخليه'], ['يجعلها', 'بيخليها'], ['شيء', 'حاجة'], ['أشياء', 'حاجات'],
    ['ماذا تفضل', 'تحب إيه'], ['هل تفضل', 'تحب'], ['هل تريد', 'تحب'], ['هل ترغب', 'تحب'], ['هل تود', 'تحب'],
    ['المزيد من التفاصيل', 'تفاصيل أكتر'], ['مزيد من التفاصيل', 'تفاصيل أكتر'], ['المزيد', 'أكتر'], ['يستغرق', 'بياخد'], ['تستغرق', 'بتاخد'],
    ['تبلغ التكلفة', 'التكلفة'], ['تبلغ', 'بتوصل'], ['يبلغ', 'بيوصل'], ['عادةً', 'عادة'], ['يمكنك', 'تقدر'], ['ويمكنك', 'وتقدر'],
    ['طويلاً', 'وقت طويل'], ['طويلا', 'وقت طويل'], ['جيداً', 'كويس'], ['جيدا', 'كويس'], ['تدريجياً', 'واحدة واحدة'],
    ['تدريجيا', 'واحدة واحدة'], ['دافئ', 'دافي'], ['دافئة', 'دافية'], ['الخطوات التالية', 'الخطوات دي'], ['التالية', 'دي'], ['التالي', 'ده'],
    ['اتركه', 'سيبه'], ['اتركها', 'سيبها'], ['أضف', 'ضيف'], ['ضع', 'حط'], ['استخدم', 'استعمل'],
    ['أرشح لك', 'أرشحلك'], ['أقول لك', 'أقولك'], ['أحكي لك', 'أحكيلك'], ['أشرح لك', 'أشرحلك'], ['أبعت لك', 'أبعتلك'],
  ],
  white: [
    ['لدينا', 'عندنا'], ['لديك', 'عندك'], ['لدي', 'عندي'], ['لديه', 'عنده'], ['نقدم لك', 'عندنا'], ['نوفر لك', 'عندنا'], ['تستطيع', 'تقدر'],
    ['بإمكانك', 'تقدر'], ['يتكون من', 'فيه'], ['يحتوي على', 'فيه'], ['تحتوي على', 'فيها'], ['شيء', 'شي'],
    ['هل تريد', 'تبي'], ['هل ترغب', 'تبي'], ['هل تود', 'تبي'], ['هل تفضل', 'تفضّل'], ['المزيد', 'أكثر'],
  ],
};
const word = (w: string) => new RegExp(`(?<![\\p{L}\\p{M}])(و|ف)?${w}(?![\\p{L}\\p{M}])`, 'gu');
/** The other dialects' own words for what is written («جيداً» → «زين / منيح / مزيان»). */
const WHITE_OWN: Record<'gulf' | 'levantine' | 'maghrebi' | 'other', Array<[string, string]>> = {
  gulf: [['المزيد من التفاصيل', 'تفاصيل أكثر'], ['يمكنك', 'تقدر'], ['لذلك', 'عشان كذا'], ['لذا', 'عشان كذا'], ['جيداً', 'زين'], ['جيدا', 'زين'],
    ['تدريجياً', 'شوي شوي'], ['تدريجيا', 'شوي شوي'], ['اتركه', 'خله'], ['اتركها', 'خلها'], ['أضف', 'حط'], ['ضع', 'حط'], ['يستغرق', 'ياخذ'], ['تستغرق', 'تاخذ'],
    ['يدوم', 'يقعد'], ['تدوم', 'تقعد'], ['تبلغ التكلفة', 'التكلفة'], ['الآن', 'الحين'], ['طويلاً', 'وقت طويل'], ['دافئ', 'دافي'], ['دافئة', 'دافية'],
    ['قم ب', ''], ['يعتبر', 'هو'], ['التالية', 'هذي'], ['المتوفرة', 'اللي'], ['لديك', 'عندك']],
  levantine: [['المزيد من التفاصيل', 'تفاصيل أكتر'], ['المزيد', 'أكتر'], ['يمكنك', 'فيك'], ['لذلك', 'مشان هيك'], ['لذا', 'مشان هيك'], ['جيداً', 'منيح'], ['جيدا', 'منيح'],
    ['تدريجياً', 'شوي شوي'], ['تدريجيا', 'شوي شوي'], ['اتركه', 'خليه'], ['اتركها', 'خليها'], ['أضف', 'حط'], ['ضع', 'حط'], ['يستغرق', 'بياخد'], ['تستغرق', 'بتاخد'],
    ['يدوم', 'بيضل'], ['تدوم', 'بتضل'], ['يتميز', 'بيتميز'], ['تبلغ التكلفة', 'التكلفة'], ['طويلاً', 'وقت طويل'], ['دافئ', 'دافي'], ['دافئة', 'دافية'],
    ['أكثر', 'أكتر'], ['كثير', 'كتير'], ['قم ب', ''], ['يعتبر', 'هو'], ['التالية', 'هاي'], ['لديك', 'عندك']],
  maghrebi: [['المزيد من التفاصيل', 'تفاصيل كثر'], ['المزيد', 'كثر'], ['يمكنك', 'تقدر'], ['لذلك', 'داكشي علاش'], ['لذا', 'داكشي علاش'], ['جيداً', 'مزيان'], ['جيدا', 'مزيان'],
    ['تدريجياً', 'بشوية'], ['تدريجيا', 'بشوية'], ['اتركه', 'خليه'], ['اتركها', 'خليها'], ['أضف', 'زيد'], ['ضع', 'حط'], ['يستغرق', 'كياخد'], ['تستغرق', 'كتاخد'],
    ['يدوم', 'كيبقى'], ['تدوم', 'كتبقى'], ['يتميز', 'كيتميز'], ['تبلغ التكلفة', 'التكلفة'], ['طويلاً', 'بزاف'], ['قم ب', ''], ['يعتبر', 'هو'],
    ['التالية', 'هادو'], ['لديك', 'عندك']],
  other: [['المزيد من التفاصيل', 'تفاصيل أكثر'], ['يمكنك', 'تقدر'], ['لذلك', 'عشان كذا'], ['جيداً', 'زين'], ['جيدا', 'زين'], ['تدريجياً', 'شوي شوي'],
    ['اتركه', 'خليه'], ['أضف', 'حط'], ['يستغرق', 'ياخذ'], ['قم ب', ''], ['التالية', 'هذي'], ['لديك', 'عندك']],
};
/** «تحب / تريد» in each dialect. */
const WANT: Partial<Record<Dialect, string>> = { gulf: 'تبي', levantine: 'بدك', maghrebi: 'بغيتي', iraqi: 'تريد', sudanese: 'داير', yemeni: 'تشتي' };
function spokenWords(text: string, talk: Talk, dialect?: Dialect): string {
  if (talk !== 'egyptian' && talk !== 'white') return text;
  const own = talk === 'white' ? WHITE_OWN[dialect === 'gulf' || dialect === 'levantine' || dialect === 'maghrebi' ? dialect : 'other'] : [];
  const table = talk === 'egyptian' ? SPOKEN_WORDS.egyptian
    : [...own, ...SPOKEN_WORDS.white.map(([from, to]) => [from, to === 'تبي' ? WANT[dialect || 'gulf'] || 'تبي' : to] as [string, string])];
  let out = text.replace(/(?<![\p{L}\p{M}])قم ب(?=\p{L})/gu, '');
  for (const [from, to] of table) {
    if (from === 'قم ب') continue;
    out = out.replace(word(from), (_m, prefix = '') => (prefix && to.startsWith('و') ? to : `${prefix}${to}`));
  }
  // «إلى السعودية» → «للسعودية»، «من أربعة إلى ست» → «من أربعة لست» (Egyptian and the Levant say «لـ»).
  if (talk === 'egyptian' || dialect === 'levantine') out = out.replace(/(?<![\p{L}\p{M}])إلى\s+(ال)?(?=\p{L})/gu, (_m, al?: string) => (al ? 'لل' : 'ل'));
  // «تحب أن أرشح» → «تحب أرشح»; «قد يقل» → «ممكن يقل» (only before a present verb).
  out = out.replace(/(?<![\p{L}\p{M}])(تحب|تبي|بدك|تقدر|ممكن|لازم|عايز)\s+أن\s+(?=\p{L})/gu, '$1 ')
    .replace(/(?<![\p{L}\p{M}])(و|ف)?قد\s+(?=[يتنأ]\p{L}{2,})/gu, (_m, prefix = '') => `${prefix}${talk === 'egyptian' ? 'ممكن' : 'يمكن'} `);
  // «هل» is not said in talk: the question is in the voice («هل تحب العود؟» → «تحب العود؟»).
  out = out.replace(/(?<![\p{L}\p{M}])(و|ف)?هل\s+/gu, (_m, prefix = '') => prefix);
  if (talk === 'egyptian') {
    for (const verb of BI_VERBS) {
      out = out.replace(word(verb), (match, prefix: string | undefined, offset: number, all: string) => {
        if (NO_BI_AFTER.test(all.slice(0, offset))) return match;
        return `${prefix || ''}ب${verb}`;
      });
    }
  }
  return out.replace(/\s{2,}/g, ' ').replace(/^\s*،\s*/u, '');
}

// ── Fixed written phrases and the written future, said the spoken way ───────────────────────────────────────
const FUTURE_VERBS = ['نتواصل', 'نبلغك', 'نرسل', 'نقوم', 'نتابع', 'نعمل', 'نحاول', 'نرد', 'نتحقق', 'نوفر', 'نعيد', 'نراجع', 'نشحن', 'نبعث', 'نعوضك', 'نتصل', 'نجهز', 'نخبرك'];
const FUTURE_SOON = ['يصل', 'تصل', 'يكون', 'تكون', 'يتم', 'تجد', 'يبقى', 'يدوم', 'تحصل', 'يعجبك', 'تلاحظ', 'يعجبها', 'يفرق'];
const FUTURE_WORD: Partial<Record<Dialect, string>> = { levantine: 'رح', maghrebi: 'غادي', sudanese: 'حا', yemeni: 'با', iraqi: 'راح', gulf: 'راح' };
function spokenPhrases(text: string, talk: Talk, dialect?: Dialect): string {
  if (talk !== 'egyptian' && talk !== 'white') {
    if (talk !== 'en') return text;
    return text.replace(/(?<![A-Za-z])In conclusion,?\s*/gu, 'So ').replace(/(?<![A-Za-z])Furthermore,?\s*/gu, 'Also, ').replace(/(?<![A-Za-z])Moreover,?\s*/gu, 'Also, ')
      .replace(/(?<![A-Za-z])Additionally,?\s*/gu, 'Plus, ').replace(/the following steps/giu, 'these steps').replace(/as follows/giu, 'like this');
  }
  const egyptian = talk === 'egyptian';
  const phrases: Array<[RegExp, string]> = egyptian ? [
    [/نعتذر بشدة (?:عن|على)/gu, 'إحنا آسفين جداً على'], [/نعتذر (?:عن|على)/gu, 'آسفين على'], [/نأسف جداً (?:عن|على)/gu, 'آسفين جداً على'], [/نأسف (?:عن|على)/gu, 'آسفين على'],
    [/(?:إليك|اليك) ما (?:يمكننا|سوف|سن)\s*(?:فعله|نفعله|عمله)/gu, 'وده اللي هنعمله'], [/(?:إليك|اليك) ما يمكنك فعله/gu, 'وده اللي تقدر تعمله'],
    [/(?:إليك|اليك) (?:الخطوات|الطريقة)/gu, 'وده اللي تعمله'], [/في أقرب وقت/gu, 'في أسرع وقت'], [/أرسل لنا/gu, 'ابعتلنا'], [/أرسل لي/gu, 'ابعتلي'],
    [/(?:يعتبر|يُعتبر|تعتبر) (?:الخيار|الاختيار)/gu, 'هو الاختيار'], [/الخيار الأرخص هو/gu, 'الأرخص هو'], [/بالنسبة (للشحن|للتوصيل) (?=ل)/gu, 'الشحن '],
    [/يرجى (?=\p{L})/gu, 'ياريت '], [/يُرجى (?=\p{L})/gu, 'ياريت '],
  ] : [
    [/نعتذر بشدة (?:عن|على)/gu, 'نعتذر منك على'], [/نأسف جداً (?:عن|على)/gu, 'نعتذر منك على'],
    [/(?:إليك|اليك) ما (?:يمكننا|سوف|سن)\s*(?:فعله|نفعله|عمله)/gu, dialect === 'levantine' ? 'وهاد اللي رح نعمله' : dialect === 'maghrebi' ? 'وهادشي اللي غادي نديرو' : 'وهذا اللي راح نسويه'],
    [/(?:إليك|اليك) ما يمكنك فعله/gu, 'وهذا اللي تقدر تسويه'], [/أرسل لنا/gu, dialect === 'maghrebi' ? 'صيفط لينا' : 'أرسل لنا'], [/يرجى (?=\p{L})/gu, 'لو سمحت '],
  ];
  // Written connectors and set phrases (every dialect).
  const lev = dialect === 'levantine';
  const magh = dialect === 'maghrebi';
  const we = egyptian ? 'إحنا' : lev ? 'نحنا' : magh ? 'حنا' : 'حنا';
  const but = magh ? 'ولكن' : 'بس';
  const lastly = egyptian ? 'وفي الآخر،' : 'وفي الأخير،';
  const also = egyptian ? 'وكمان،' : lev ? 'وكمان،' : magh ? 'وزيد على هادشي،' : 'وبعد،';
  const fewThings = egyptian ? 'كام حاجة' : lev ? 'كم شغلة' : magh ? 'شي حوايج' : 'كم شي';
  const soon = egyptian ? 'هيتم' : lev ? 'رح يصير' : magh ? 'غادي يكون' : 'بيتم';
  phrases.unshift(
    [/نحن نتفهم انزعاجك(?:\s+تماماً|\s+تماما)?/gu, egyptian ? 'حاسين بيك وعندك حق' : lev ? 'حاسين فيك ومعك حق' : magh ? 'فاهمينك وعندك الحق' : 'فاهمين عليك ومعك حق'],
    [/ونعتذر (?:عن|على) ذلك/gu, egyptian ? 'وآسفين على كده' : lev ? 'ومنعتذر منك' : 'ونعتذر منك'],
    [/(?:ف|و)?توقف عن استخدامه/gu, egyptian ? 'بطّل تستعمله' : lev ? 'وقّف تستعمله' : 'وقف استخدامه'],
    [/(?<![\p{L}\p{M}])(و|ف)?لا تضع/gu, `$1${egyptian ? 'ما تحطش' : 'لا تحط'}`], [/(?<![\p{L}\p{M}])(و|ف)?لا ترش(?![\p{L}\p{M}])/gu, `$1${egyptian ? 'ما ترشش' : 'لا ترش'}`],
  );
  if (egyptian) phrases.push([/(?<![\p{L}\p{M}])فوراً/gu, 'على طول'], [/(?<![\p{L}\p{M}])فورا(?![\p{L}\p{M}])/gu, 'على طول']);
  phrases.push(
    [/(?<![\p{L}\p{M}])كما أن\s+/gu, egyptian ? 'وكمان ' : magh ? 'وزيد ' : 'وكمان '], [/،?\s*مما يجعل\s+/gu, egyptian ? '، وده بيخلي ' : lev ? '، وهاد بيخلي ' : '، وهذا يخلي '],
    [/(?<![\p{L}\p{M}])(?:يُفضّل|يفضل|يُفضل|يفضّل)\s+/gu, egyptian ? 'الأحسن ' : 'الأفضل '], [/(?<![\p{L}\p{M}])حسناً،?\s*/gu, egyptian ? 'طيب، ' : 'طيب، '],
    [/(?<![\p{L}\p{M}])(تقدر|فيك) (?:ذلك|ده)(?:\s+بالتأكيد)?(?![\p{L}\p{M}])/gu, egyptian ? '$1 طبعاً' : '$1 أكيد'],
    [/(?<![\p{L}\p{M}])(?:و)?لم يتم استخدامه/gu, egyptian ? 'ومش مستعمل' : lev ? 'وما انستعمل' : 'وما انستخدم'], [/(?<![\p{L}\p{M}])لا يمكن(?![\p{L}\p{M}])/gu, egyptian ? 'مينفعش' : 'ما ينفع'],
    [/(?<![\p{L}\p{M}])وفقاً ل/gu, egyptian ? 'على حسب ' : 'حسب '], [/بشرط أن/gu, 'بشرط'], [/(?<![\p{L}\p{M}])يوماً(?![\p{L}\p{M}])/gu, 'يوم'], [/(?<![\p{L}\p{M}])شهراً(?![\p{L}\p{M}])/gu, 'شهر'],
    [/(?<![\p{L}\p{M}])مختوماً(?![\p{L}\p{M}])/gu, 'مختوم'], [/(?<![\p{L}\p{M}])أصلياً(?![\p{L}\p{M}])/gu, 'أصلي'], [/(?<![\p{L}\p{M}])جديداً(?![\p{L}\p{M}])/gu, 'جديد'], [/(?<![\p{L}\p{M}])يمنحك(?![\p{L}\p{M}])/gu, egyptian ? 'بيديك' : lev ? 'بيعطيك' : 'يعطيك'],
    [/(?<![\p{L}\p{M}])تأتي(?![\p{L}\p{M}])/gu, egyptian ? 'بتيجي' : lev ? 'بتجي' : 'تجي'], [/(?<![\p{L}\p{M}])جميع(?=\s+\p{L})/gu, egyptian ? 'كل' : 'كل'],
    [/من حيث\s+/gu, 'في '], [/(?<![\p{L}\p{M}])فإن\s+/gu, ''], [/(?<![\p{L}\p{M}])بينما\s+/gu, `${but} `], [/في الختام،?\s*/gu, `${lastly} `],
    [/(?:علاوة على ذلك|بالإضافة إلى ذلك|إضافة إلى ذلك)،?\s*/gu, `${also} `], [/(?:يُنصح|ينصح) بما يلي/gu, `أنصحك ب${fewThings}`], [/(?:يُنصح|ينصح) ب(?=\p{L})/gu, 'أنصحك ب'],
    [/(?<![\p{L}\p{M}])(?:ب)?ما يلي/gu, fewThings], [/نحن نتفهم/gu, egyptian ? 'فاهمينك' : lev ? 'فاهمينك' : magh ? 'فاهمينك' : 'فاهمينك'], [/(?<![\p{L}\p{M}])نتفهم/gu, 'فاهمين'],
    [/انزعاجك/gu, egyptian ? 'زعلك' : lev ? 'زعلك' : magh ? 'القلق ديالك' : 'زعلك'], [/(?<![\p{L}\p{M}])تماماً/gu, egyptian ? 'جداً' : 'زين'],
    [/(?<![\p{L}\p{M}])نحن(?![\p{L}\p{M}])/gu, we], [/(?<![\p{L}\p{M}])(?:و)?سيتم(?![\p{L}\p{M}])/gu, soon], [/(?<![\p{L}\p{M}])(?<!(?:لم|لن|أن|ان) )يتم(?![\p{L}\p{M}])/gu, egyptian ? 'بيتم' : lev ? 'بيصير' : 'يصير'],
    [/(?:تودّ|تود|تودين) أن/gu, egyptian ? 'تحب' : WANT[dialect || 'gulf'] || 'تبي'], [/(?<![\p{L}\p{M}])(?:تودّ|تود)(?![\p{L}\p{M}])/gu, egyptian ? 'تحب' : WANT[dialect || 'gulf'] || 'تبي'],
  );
  if (egyptian) phrases.push([/(?<![\p{L}\p{M}])تجنب(?![\p{L}\p{M}])/gu, 'ابعد عن'], [/(?<![\p{L}\p{M}])تجنّب(?![\p{L}\p{M}])/gu, 'ابعد عن']);
  // «قم بتجربته» / «يرجى تصوير» / «يمكنك إضافة»: the written verbal noun said as the verb people use.
  const ACTS: Array<[string, string, string]> = [
    ['تجربته', 'جرّبه', 'تجرّبه'], ['تجربتها', 'جرّبها', 'تجرّبها'], ['تجربة', 'جرّب', 'تجرّب'], ['رشه', 'رشّه', 'ترشّه'], ['رش', 'رش', 'ترش'], ['وضع', egyptian ? 'حط' : 'حط', 'تحط'],
    ['إضافة', egyptian ? 'ضيف' : magh ? 'زيد' : 'حط', egyptian ? 'تضيف' : magh ? 'تزيد' : 'تضيف'], ['استخدام', egyptian ? 'استعمل' : 'استخدم', egyptian ? 'تستعمل' : 'تستخدم'],
    ['حساب', 'احسب', 'تحسب'], ['إرجاع', 'رجّع', 'ترجّع'], ['ارجاع', 'رجّع', 'ترجّع'], ['استبدال', 'بدّل', 'تبدّل'], ['تصوير', 'صوّر', 'تصوّر'], ['إرسال', egyptian ? 'ابعت' : magh ? 'صيفط' : 'أرسل', egyptian ? 'تبعت' : magh ? 'تصيفط' : 'ترسل'],
    ['شراء', egyptian ? 'اشتري' : 'اشتر', 'تشتري'], ['اختيار', egyptian ? 'اختار' : 'اختر', 'تختار'], ['تخزين', 'خزّن', 'تخزّن'], ['متابعة', 'تابع', 'تتابع'], ['طلب', 'اطلب', 'تطلب'],
  ];
  for (const [noun, imperative, verb] of ACTS) {
    phrases.push(
      [new RegExp(`(?<![\\p{L}\\p{M}])(و|ف)?(?:قم|قومي) ب${noun}(?![\\p{L}\\p{M}])`, 'gu'), `$1${imperative}`],
      [new RegExp(`(?<![\\p{L}\\p{M}])(و|ف)?(?:يرجى|يُرجى|ياريت|لو سمحت) ${noun}(?![\\p{L}\\p{M}])`, 'gu'), `$1${imperative}`],
      [new RegExp(`(?<![\\p{L}\\p{M}])(تقدر|ممكن|فيك) (?:ال)?${noun}(?![\\p{L}\\p{M}])`, 'gu'), `$1 ${verb}`],
    );
  }
  let out = text;
  for (const [re, to] of phrases) out = out.replace(re, to);
  // A sentence that still opens with «إليك / فيما يلي» just drops it.
  out = out.replace(/(^|[.!؟?]\s+)(?:إليك|اليك|فيما يلي|في ما يلي)\s+/gu, '$1');
  const future = egyptian ? 'ه' : `${FUTURE_WORD[dialect || 'gulf'] || 'راح'} `;
  out = out.replace(new RegExp(`(?<![\\p{L}\\p{M}])(و|ف)?س(${FUTURE_VERBS.join('|')}|${FUTURE_SOON.join('|')})(?![\\p{L}\\p{M}])`, 'gu'), (_m, prefix = '', verb: string) => `${prefix}${future}${verb}`)
    .replace(/(?<![\p{L}\p{M}])(و|ف)?سأ(\p{L}{3,})/gu, (_m, prefix = '', verb: string) => `${prefix}${egyptian ? 'ه' : `${future}أ`}${verb}`);
  if (!egyptian) out = out.replace(/(?<![\p{L}\p{M}])(و|ف)?سوف\s+/gu, (_m, prefix = '') => `${prefix}${future}`);
  return out.replace(/(?<=[^\s])ه (?=\p{L})/gu, (m) => m).replace(/\s{2,}/g, ' ');
}

/** A sentence longer than a breath (about 24 words) split where the speaker would pause («، و…» / «، بس…»). */
function breathe(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  if (words.length <= 24) return [sentence];
  const cut = sentence.search(/،\s+(?=(?:و|بس|لكن|عشان|لأن|but|and|so)\s)/u);
  if (cut < 0 || cut < sentence.length * 0.25) return [sentence];
  const first = endSentence(sentence.slice(0, cut));
  const rest = sentence.slice(cut + 1).trim();
  return [first, ...breathe(rest.charAt(0).toUpperCase() + rest.slice(1))];
}

// ── A natural opener now and then ───────────────────────────────────────────────────────────────────────────
const OPENERS: Record<Talk, string[]> = {
  egyptian: ['بص،', 'بصراحة،', 'طيب،', 'شوف،'],
  white: ['شوف،', 'بصراحة،', 'طيب،'],
  msa: [],
  en: ['So,', 'Well,', 'Honestly,'],
};
const NO_OPENER = /^(?:آه|اه|أه|تقصد|قصدك|من الآخر|باختصار|في الثبات|نعتذر|نأسف|آسف|اسف|إحنا آسفين|حقك علينا|معلش|للأسف|عذراً|sorry|we apologi|I'm sorry|I am sorry|فهمت|حاضر|أهلا|اهلا|أهلاً|اهلاً|مرحب|السلام|صباح|مساء|أيوه|ايوه|أيوة|لا\b|لأ|نعم|أكيد|اكيد|تمام|طبعاً|طبعا|بص|بصراحة|طيب|شوف|معلش|للأسف|عفواً|hi\b|hello|hey|yes|no\b|sure|so,|well,|honestly|sorry|unfortunately)/iu;
const hash = (text: string) => { let h = 0; for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0; return h; };

/** The reply re-said as talk (still plain text with sentences; spokenReply puts numbers and words into speech). */
export function talkify(text: string, { language, dialect, opener = true }: { language: SupportedLanguage; dialect?: Dialect; opener?: boolean }): string {
  const talk = talkOf(language, dialect);
  if (!talk) return text;
  const clean = removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(text)));
  // «✅ عود ملكي» / «🔹 …» / «👉 …»: an emoji used as a bullet is a list point.
  const lines = clean.split('\n').map((line) => line.replace(/^(\s*)(?:✅|✔️|✔|☑️|🔹|🔸|▪️|▫️|➡️|👉|⭐|🌟|✨|🎁|💡|📌|🔥)\s*/u, '$1- '));
  const out: string[] = [];
  let inFence = false;
  let header: string[] | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    if (/^\s*(```|~~~)/u.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const line = raw.trim();
    if (!line) continue;
    // A list (with the line before it if that line introduced it).
    if (/^(?:[-*+•]|\d+[.)])\s+/u.test(line)) {
      const numbered = /^\d+[.)]\s/u.test(line);
      const block: string[] = [];
      while (i < lines.length && (/^\s*(?:[-*+•]|\d+[.)])\s+/u.test(lines[i]!) || (block.length && /^\s{2,}\S/u.test(lines[i]!)))) {
        const item = lines[i]!;
        if (/^\s{2,}(?:[-*+•]|\d+[.)])\s+/u.test(item) && block.length) {
          const sub = item.trim().replace(/^(?:[-*+•]|\d+[.)])\s+/u, '');
          // «المكونات: الافتتاحية: برجموت · القلب: ورد» (labels inside labels) is left for the next step to say.
          const phrase = /[:：].*[:：]/u.test(sub) ? undefined : labelled(sub, talk);
          const said = phrase || sub;
          const head = block[block.length - 1]!.replace(/[.،]$/u, '');
          // «- **كشمير أبيض**» then its points: the points describe it («كشمير أبيض — بيتميز بـ…، وسعره…»).
          block[block.length - 1] = /^\s*(?:[-*+•]|\d+[.)])\s+\*\*[^*]+\*\*$/u.test(head) ? `${head} — ${said.replace(/[.،]$/u, '')}` : `${head}${talk === 'en' ? ',' : phrase ? '، و' : '، '}${said.replace(/[.،]$/u, '')}`;
        }
        else block.push(item.trim());
        i += 1;
      }
      i -= 1;
      const introIndex = out.length - 1;
      const intro = introIndex >= 0 && /[:：]\s*$/u.test(out[introIndex]!) ? out.pop() : undefined;
      out.push(...sayList(intro, block, numbered, talk));
      continue;
    }
    // A title («### مواصفات العطر» / «**المميزات:**») is said as a short lead-in to what follows it.
    const heading = /^#{1,6}\s+/u.test(line) || /^\*\*[^*]{1,60}\*\*:?$/u.test(line);
    const plain = line.replace(/^#{1,6}\s+/u, '').replace(/^\*\*([^*]+)\*\*:?$/u, '$1').trim();
    // «الخطوات التالية:» / «التفاصيل:»: a label for the eye only — the list itself says it («أول حاجة…»).
    if (heading && /^(?:الخطوات التالية|الخطوات|ما يلي|التفاصيل|المميزات|المواصفات|الملخص|Steps|Details|Features|Summary)\s*:?$/iu.test(plain)) continue;
    // A title that asks («ليه الاتجاه ده؟») is said: it is how a speaker leads into the answer.
    if (heading && plain.split(/\s+/).length <= 6 && !/[?؟]$/u.test(plain)) {
      const next = lines.slice(i + 1).find((l) => l.trim());
      out.push(`${plain.replace(/:$/u, '')}${next && /^\s*(?:[-*+•]|\d+[.)])\s+/u.test(next) ? ':' : '.'}`);
      continue;
    }
    // Tables: each row said as a sentence (first column, then the rest).
    if (/^\|.*\|$/u.test(line)) {
      if (/^\|\s*:?-{2,}/u.test(line)) continue;
      const cellsOf = (row: string) => row.replace(/^\|/u, '').replace(/\|$/u, '').split('|').map((c) => c.replace(/\*\*/g, '').trim());
      const cells = cellsOf(line);
      const nextLine = lines[i + 1]?.trim() || '';
      if (/^\|\s*:?-{2,}/u.test(nextLine)) { header = cells; continue; } // the header row: names the columns
      // «السعر: عود ملكي بألف وميتين، وعنبر الليل بتسعمية وتمانين» — each value said with its column's name.
      const comma = talk === 'en' ? ', ' : '، ';
      const and = talk === 'en' ? 'and ' : 'و';
      const named = header && header.length === cells.length && header.slice(1).every(Boolean);
      const values = cells.slice(1).map((value, k) => (named ? `${header![k + 1]} ${value}` : value)).filter((v) => v.trim());
      const said = values.length > 1 ? `${values.slice(0, -1).join(comma)}${comma}${and}${values[values.length - 1]}` : values[0] || '';
      if (cells[0] || said) out.push(endSentence(cells[0] && said ? `${cells[0]}${talk === 'en' ? ':' : '،'} ${said}` : cells[0] || said));
      continue;
    }
    header = undefined;
    const said = labelled(line, talk);
    out.push(said ? endSentence(said) : line);
  }
  // Openers off, words said the spoken way, long sentences cut at a breath.
  let sentences = out.map((s, i) => (i === 0 ? cleanOpening(s) : s)).filter(Boolean)
    .map((s) => s.replace(/\*\*([^*]+)\*\*/g, '$1'))
    .map((s) => spokenPhrases(spokenWords(s, talk, dialect), talk, dialect))
    .flatMap((s) => s.split(/(?<=[.!?؟])\s+/u))
    .map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s))
    .flatMap(breathe);
  // A reply never starts on a joining word («وكمان، …» left after «اختيار رائع! علاوة على ذلك…» was dropped).
  if (sentences.length) sentences[0] = sentences[0]!.replace(/^(?:وكمان|وبعد|وزيد على هادشي|وفي الآخر|وفي الأخير|Also|Plus)[،,]\s*/u, '').replace(/^\s*و(?=\p{L}{3,}\s)/u, (m) => m);
  if (sentences.length && /^\p{Ll}/u.test(sentences[0]!)) sentences[0] = sentences[0]!.charAt(0).toUpperCase() + sentences[0]!.slice(1);
  if (opener && sentences.length >= 2 && OPENERS[talk].length) {
    const first = sentences[0]!;
    const h = hash(text);
    // About half the replies start with an opener — and never a greeting, a yes/no, an apology or a question.
    if (h % 2 === 0 && !NO_OPENER.test(first) && !/[?؟]$/u.test(first)) {
      const word = OPENERS[talk][Math.floor(h / 2) % OPENERS[talk].length]!;
      const lower = talk === 'en' && !/^I(?:\b|')/u.test(first) ? first.charAt(0).toLowerCase() + first.slice(1) : first;
      sentences = [`${word} ${lower}`, ...sentences.slice(1)];
    }
  }
  return sentences.join('\n');
}
