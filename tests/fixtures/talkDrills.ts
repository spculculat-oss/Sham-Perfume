/**
 * «تمارين الكلام الطبيعي»: whole multi-turn voice conversations — buying, a cheaper one, «كمّل», kids in the room,
 * an upset customer, a hurried one, steps, specs, a comparison, a change of topic — in five dialects.
 * Each turn has what the visitor said, the WRITTEN reply an engine / his memory / the store gave (Markdown, lists,
 * MSA — the literal input), and what a good voice turn must do.
 * Two sets that share nothing: TRAINING (products A, written style A) for tuning, and HELD-OUT (other products, other
 * written style B, other wordings) to check the rules generalize. Never tune on the held-out set.
 */
import type { Dialect } from '../../src/utils/arabicDialect';
import type { VoiceMood } from '../../src/utils/voiceMood';

export interface DrillTurn {
  /** What the visitor said. */
  said: string;
  /** The written reply (undefined when nothing should be answered: speech to someone else). */
  written?: string;
  expect: {
    /** reply = answer; aside = to someone else (go on talking); more = «كمّل» (say the rest, no new question). */
    action: 'reply' | 'aside' | 'more';
    /** A name the spoken answer must say (context: «الأرخص فيهم؟»). */
    refer?: string;
    mood?: VoiceMood;
  };
}
export interface Drill { id: string; language: 'ar' | 'en'; dialect?: Dialect; kind: string; turns: DrillTurn[] }

interface Product { name: string; price: number; ml: number; hours: number; notes: string[]; family: string; occasion: string }
const TRAIN_PRODUCTS: Product[] = [
  { name: 'عود ملكي', price: 1250, ml: 100, hours: 10, notes: ['عود', 'ورد', 'مسك'], family: 'شرقي خشبي', occasion: 'السهرات' },
  { name: 'عنبر الليل', price: 980, ml: 50, hours: 8, notes: ['عنبر', 'فانيليا', 'قرفة'], family: 'شرقي دافئ', occasion: 'الشتاء' },
  { name: 'مسك الطهارة', price: 350, ml: 30, hours: 6, notes: ['مسك أبيض', 'زهر القطن'], family: 'مسكي ناعم', occasion: 'الدوام' },
  { name: 'ورد الطائف', price: 1500, ml: 100, hours: 9, notes: ['ورد طائفي', 'زعفران', 'عود'], family: 'زهري شرقي', occasion: 'الأعراس' },
  { name: 'بحر الصيف', price: 650, ml: 100, hours: 5, notes: ['برجموت', 'ليمون', 'نوتات بحرية'], family: 'منعش', occasion: 'الصيف' },
  { name: 'جلد ودخان', price: 1100, ml: 75, hours: 9, notes: ['جلد', 'تبغ', 'فيتيفر'], family: 'خشبي جلدي', occasion: 'السهرات' },
  { name: 'فانيليا مدغشقر', price: 720, ml: 50, hours: 7, notes: ['فانيليا', 'تونكا', 'كراميل'], family: 'حلو دافئ', occasion: 'الشتاء' },
  { name: 'نسيم الصباح', price: 480, ml: 50, hours: 5, notes: ['شاي أخضر', 'نعناع', 'ليمون'], family: 'منعش أخضر', occasion: 'الصباح' },
];
const HELD_PRODUCTS: Product[] = [
  { name: 'صندل ميسور', price: 1350, ml: 100, hours: 10, notes: ['صندل', 'هيل', 'مسك'], family: 'خشبي كريمي', occasion: 'المساء' },
  { name: 'ياسمين الليل', price: 890, ml: 75, hours: 7, notes: ['ياسمين', 'برتقال', 'عنبر'], family: 'زهري', occasion: 'الخروجات' },
  { name: 'بخور مكة', price: 560, ml: 50, hours: 8, notes: ['بخور', 'لبان', 'عود'], family: 'شرقي دخاني', occasion: 'الجمعة' },
  { name: 'تفاح أخضر', price: 420, ml: 100, hours: 4, notes: ['تفاح', 'كمثرى', 'مسك'], family: 'فاكهي منعش', occasion: 'الجامعة' },
  { name: 'زعفران وعود', price: 1700, ml: 100, hours: 11, notes: ['زعفران', 'عود', 'جلد'], family: 'شرقي فاخر', occasion: 'المناسبات' },
  { name: 'لافندر بروفانس', price: 610, ml: 50, hours: 6, notes: ['لافندر', 'إكليل الجبل', 'خشب الأرز'], family: 'عطري', occasion: 'الربيع' },
];

type Talk = 'egyptian' | 'gulf' | 'levantine' | 'maghrebi' | 'en';
const DIALECTS: Talk[] = ['egyptian', 'gulf', 'levantine', 'maghrebi', 'en'];

/** What visitors say, per dialect. Two wordings: [training, held-out]. */
const SAYS: Record<string, Record<Talk, [string, string]>> = {
  winter: {
    egyptian: ['عايز عطر للشتا يكون ثابت', 'محتاج ريحة تقعد معايا في البرد'],
    gulf: ['أبي عطر للشتاء يكون ثابت', 'ودي بعطر يثبت في البرد'],
    levantine: ['بدي عطر للشتي يكون ثابت', 'شو بتنصحني بعطر بيثبت بالبرد'],
    maghrebi: ['بغيت عطر ديال الشتا يكون ثابت', 'عطيني شي عطر كيثبت فالبرد'],
    en: ['I want a long lasting perfume for winter', 'what lasts well in cold weather'],
  },
  cheaper: {
    egyptian: ['طب والأرخص فيهم؟', 'أنهي فيهم أوفر؟'], gulf: ['طيب وأرخص واحد؟', 'وش الأوفر فيهم؟'], levantine: ['طيب وأرخص واحد؟', 'أي واحد أوفر؟'],
    maghrebi: ['واش كاين شي واحد رخيص؟', 'شكون فيهم أرخص؟'], en: ['and which one is cheaper?', 'which is the budget one?'],
  },
  more: {
    egyptian: ['أيوه كمل', 'اه قول كمان'], gulf: ['ايه كمل', 'أبي كمل'], levantine: ['اي كمّل', 'يلا كمل'], maghrebi: ['اه كمل', 'كمّل'], en: ['yes go on', 'sure, continue'],
  },
  kids: {
    egyptian: ['يا أحمد اسكت شوية', 'يا ولاد وطوا صوتكم'], gulf: ['يا ولد اسكت شوي', 'يا عيال خلاص'], levantine: ['يا ماما اسكتي شوي', 'يا ولاد بس'],
    maghrebi: ['يا ولدي سكت شوية', 'يا دراري بركاو'], en: ['honey please be quiet', 'mom one second'],
  },
  upset: {
    egyptian: ['الأوردر اتأخر أسبوع وأنا زهقت بجد', 'الطلب موصلش لحد دلوقتي وأنا متضايق جدا'],
    gulf: ['الطلب تأخر أسبوع وأنا زهقت', 'الطلب ما وصلني للحين وأنا متضايق'],
    levantine: ['الطلب تأخر جمعة وأنا زهقت', 'الطلب ما وصل لهلق وأنا متضايق كتير'],
    maghrebi: ['الطلب تعطل سيمانة وأنا عييت', 'الطلبية ما وصلاتش حتى لدابا وأنا مقلق'],
    en: ['my order is a week late and I am really angry', 'the order never arrived, this is ridiculous'],
  },
  hurried: {
    egyptian: ['بسرعة لو سمحت بكام {p}؟', 'أنا مستعجل، {p} سعره كام؟'], gulf: ['بسرعة لو سمحت بكم {p}؟', 'أنا مستعجل، كم سعر {p}؟'],
    levantine: ['بسرعة لو سمحت قديش {p}؟', 'أنا مستعجل، قديش سعر {p}؟'], maghrebi: ['بسرعة عافاك بشحال {p}؟', 'أنا مزروب، شحال الثمن ديال {p}؟'],
    en: ['quick, how much is {p}?', "I'm in a rush, what does {p} cost?"],
  },
  steps: {
    egyptian: ['ازاي أخفف الكحول؟', 'أعمل إيه عشان أخفف كحول تسعين لسبعين؟'], gulf: ['كيف أخفف الكحول؟', 'وش أسوي عشان أخفف الكحول؟'],
    levantine: ['كيف بخفف الكحول؟', 'شو لازم أعمل لخفف الكحول؟'], maghrebi: ['كيفاش نخفف الكحول؟', 'شنو خاصني ندير باش نخفف الكحول؟'],
    en: ['how do I dilute the alcohol?', 'what are the steps to dilute alcohol?'],
  },
  specs: {
    egyptian: ['قولي مواصفات {p}', 'إيه تفاصيل {p}؟'], gulf: ['وش مواصفات {p}؟', 'عطني تفاصيل {p}'], levantine: ['شو مواصفات {p}؟', 'خبرني عن {p}'],
    maghrebi: ['شنو هي المواصفات ديال {p}؟', 'عطيني التفاصيل ديال {p}'], en: ['tell me about {p}', 'what are the details of {p}?'],
  },
  compare: {
    egyptian: ['قارنلي بين {p} و{q}', 'إيه الفرق بين {p} و{q}؟'], gulf: ['قارن لي بين {p} و{q}', 'وش الفرق بين {p} و{q}؟'],
    levantine: ['قارنلي بين {p} و{q}', 'شو الفرق بين {p} و{q}؟'], maghrebi: ['قارن ليا بين {p} و{q}', 'شنو الفرق بين {p} و{q}؟'],
    en: ['compare {p} and {q}', "what's the difference between {p} and {q}?"],
  },
  shipping: {
    egyptian: ['طب سيبك من ده، الشحن للسعودية بكام؟', 'بمناسبة الكلام، التوصيل لدبي بياخد قد إيه؟'],
    gulf: ['طيب خلنا من هذا، الشحن للسعودية بكم؟', 'على طاري التوصيل، كم ياخذ لدبي؟'],
    levantine: ['طيب خلينا من هيك، الشحن للسعودية قديش؟', 'بالمناسبة، التوصيل لدبي قديش بياخد؟'],
    maghrebi: ['خلينا من هادشي، الشحن للسعودية بشحال؟', 'وبالنسبة للتوصيل لدبي، شحال كياخد؟'],
    en: ['forget that, how much is shipping to Saudi?', 'by the way, how long does delivery to Dubai take?'],
  },
};
const say = (kind: string, talk: Talk, held: boolean, p?: Product, q?: Product) =>
  SAYS[kind]![talk][held ? 1 : 0].replace('{p}', p?.name || '').replace('{q}', q?.name || '');

// ── Written replies: style A (training) and style B (held-out) — both the way a page answer is written ──────
const ar = (n: number) => n.toLocaleString('en-US');
function writtenList(items: Product[], style: 'A' | 'B', en: boolean): string {
  if (en) {
    return style === 'A'
      ? `Sure! Here are the best options:\n\n${items.map((p, i) => `${i + 1}. **${p.name}** — ${p.family}, lasts about ${p.hours} hours.`).join('\n')}\n\nWould you like more details?`
      : `Great question! Below are my top picks:\n${items.map((p) => `- **${p.name}**: ideal for ${p.occasion}, ${p.ml} ml.`).join('\n')}\nDo you want me to compare them?`;
  }
  return style === 'A'
    ? `بالتأكيد! إليك أفضل ${items.length} خيارات للشتاء:\n\n${items.map((p, i) => `${i + 1}. **${p.name}** — يتميز بطابع ${p.family} ويدوم حوالي ${p.hours} ساعات.`).join('\n')}\n\nهل تريد المزيد من التفاصيل؟`
    : `سؤال رائع! فيما يلي أبرز الترشيحات:\n${items.map((p) => `- **${p.name}**: مناسب لـ${p.occasion}، ويحتوي على ${p.notes.slice(0, 2).join(' و')}.`).join('\n')}\nهل ترغب في أن أقارن بينها؟`;
}
function writtenCheaper(p: Product, style: 'A' | 'B', en: boolean): string {
  if (en) return style === 'A' ? `The most affordable option is **${p.name}** at ${p.price} EGP for ${p.ml} ml.` : `**${p.name}** is the budget pick: ${p.price} EGP (${p.ml} ml).`;
  return style === 'A'
    ? `الخيار الأرخص هو **${p.name}** بسعر ${ar(p.price)} جنيه لحجم ${p.ml} مل، وهو يتميز بثبات جيد.`
    : `### الأوفر\n**${p.name}** — السعر: ${ar(p.price)} جنيه · ${p.ml} مل. لذلك يعتبر الخيار الأنسب لميزانيتك.`;
}
function writtenUpset(style: 'A' | 'B', en: boolean): string {
  if (en) return style === 'A'
    ? `We sincerely apologize for the delay. Here is what we can do:\n1. Check the shipment status now.\n2. Contact the courier.\n3. Update you within 24 hours.`
    : `I'm really sorry about this. Furthermore, the following steps will help:\n- Send your order number.\n- We will track it with the courier.`;
  return style === 'A'
    ? `نعتذر بشدة عن هذا التأخير. إليك ما يمكننا فعله:\n1. سوف نتحقق من حالة الشحنة الآن.\n2. سنتواصل مع شركة الشحن.\n3. سنبلغك بالتحديث خلال 24 ساعة.`
    : `نأسف جداً على ذلك. فيما يلي الخطوات التالية:\n- أرسل لنا رقم الطلب.\n- سوف نتابع مع شركة التوصيل ونرد عليك في أقرب وقت.`;
}
function writtenPrice(p: Product, style: 'A' | 'B', en: boolean): string {
  if (en) return style === 'A' ? `**${p.name}**: ${p.price} EGP (${p.ml} ml).` : `Price of ${p.name} — ${p.price} EGP for ${p.ml} ml.`;
  return style === 'A' ? `سعر **${p.name}**: ${ar(p.price)} جنيه (${p.ml} مل).` : `**${p.name}** · ${ar(p.price)} جنيه · ${p.ml} مل`;
}
function writtenSteps(style: 'A' | 'B', en: boolean): string {
  if (en) return style === 'A'
    ? `Sure! Follow these steps:\n1. Measure the alcohol you have.\n2. Add distilled water gradually.\n3. Stir well and let it rest for two days.`
    : `### Steps\n1. Calculate the amount needed.\n2. Pour in distilled water slowly.\n3. Mix and leave it for 48 hours.`;
  return style === 'A'
    ? `بالتأكيد! لتخفيف الكحول اتبع الخطوات التالية:\n1. احسب كمية الكحول المتوفرة لديك.\n2. أضف الماء المقطر تدريجياً.\n3. قلّب جيداً واتركه يرتاح يومين.`
    : `### خطوات التخفيف\n1. قم بحساب الكمية المطلوبة.\n2. ضع الماء المقطر ببطء.\n3. امزج المحلول ثم اتركه 48 ساعة.`;
}
function writtenSpecs(p: Product, style: 'A' | 'B', en: boolean): string {
  if (en) return style === 'A'
    ? `### ${p.name}\n- Price: ${p.price} EGP\n- Longevity: ${p.hours} hours\n- Notes: ${p.notes.join(', ')}`
    : `**${p.name}**\n- Size: ${p.ml} ml\n- Best for: ${p.occasion}\n- Family: ${p.family}`;
  return style === 'A'
    ? `### مواصفات ${p.name}\n- السعر: ${ar(p.price)} جنيه\n- الثبات: ${p.hours} ساعات\n- النوتات: ${p.notes.join('، ')}\n- مناسب لـ: ${p.occasion}`
    : `**${p.name}**\n- الحجم: ${p.ml} مل\n- العائلة العطرية: ${p.family}\n- المكونات: ${p.notes.join('، ')}\n- الفوحان: متوسط`;
}
function writtenCompare(p: Product, q: Product, style: 'A' | 'B', en: boolean): string {
  if (en) return `| | ${p.name} | ${q.name} |\n|---|---|---|\n| Price | ${p.price} EGP | ${q.price} EGP |\n| Longevity | ${p.hours} h | ${q.hours} h |\n\n${style === 'A' ? `In conclusion, ${p.hours >= q.hours ? p.name : q.name} lasts longer.` : `${p.price <= q.price ? p.name : q.name} is cheaper.`}`;
  return style === 'A'
    ? `| المقارنة | ${p.name} | ${q.name} |\n|---|---|---|\n| السعر | ${ar(p.price)} جنيه | ${ar(q.price)} جنيه |\n| الثبات | ${p.hours} ساعات | ${q.hours} ساعات |\n\nباختصار، ${p.hours >= q.hours ? p.name : q.name} أثبت.`
    : `### الفرق بينهما\n- **${p.name}**: ${p.family}، يدوم ${p.hours} ساعات.\n- **${q.name}**: ${q.family}، يدوم ${q.hours} ساعات.\n\nإذا كنت تريد الثبات فاختر ${p.hours >= q.hours ? p.name : q.name}.`;
}
function writtenShipping(style: 'A' | 'B', en: boolean): string {
  if (en) return style === 'A' ? `Shipping to Saudi Arabia costs about 350 EGP and takes 5-7 days.` : `Delivery to Dubai usually takes 4-6 business days.`;
  return style === 'A'
    ? `بالنسبة للشحن إلى السعودية، تبلغ التكلفة حوالي 350 جنيه ويستغرق التوصيل من 5-7 أيام.`
    : `يستغرق التوصيل إلى دبي عادةً من 4 إلى 6 أيام عمل، ويمكنك متابعة الشحنة من صفحة الطلب.`;
}

const dialectOf = (talk: Talk): Dialect | undefined => (talk === 'en' ? undefined : talk);
const pick = <T>(list: T[], i: number) => list[i % list.length]!;

function drills(held: boolean): Drill[] {
  const products = held ? HELD_PRODUCTS : TRAIN_PRODUCTS;
  const style = held ? 'B' : 'A';
  const out: Drill[] = [];
  products.forEach((p, n) => {
    const q = pick(products, n + 1);
    const r = pick(products, n + 2);
    for (const talk of DIALECTS) {
      const en = talk === 'en';
      const base = { language: (en ? 'en' : 'ar') as 'ar' | 'en', ...(dialectOf(talk) ? { dialect: dialectOf(talk) } : {}) };
      const id = (kind: string) => `${held ? 'H' : 'T'}-${kind}-${n}-${talk}`;
      const three = [p, q, r];
      const cheapest = three.reduce((a, b) => (b.price < a.price ? b : a));
      // 1. Buying: a list, then «the cheaper one?», then «go on».
      out.push({ id: id('buy'), ...base, kind: 'شراء وتكملة', turns: [
        { said: say('winter', talk, held), written: writtenList(three, style, en), expect: { action: 'reply' } },
        { said: say('cheaper', talk, held), written: writtenCheaper(cheapest, style, en), expect: { action: 'reply', refer: cheapest.name } },
        { said: say('more', talk, held), expect: { action: 'more' } },
      ] });
      // 2. Kids in the room in the middle of the answer.
      out.push({ id: id('kids'), ...base, kind: 'أطفال حواليه', turns: [
        { said: say('specs', talk, held, p), written: writtenSpecs(p, style, en), expect: { action: 'reply', refer: p.name } },
        { said: say('kids', talk, held), expect: { action: 'aside' } },
        { said: say('cheaper', talk, held), written: writtenCheaper(cheapest, style, en), expect: { action: 'reply', refer: cheapest.name } },
      ] });
      // 3. An upset customer.
      out.push({ id: id('upset'), ...base, kind: 'عميل زعلان', turns: [
        { said: say('upset', talk, held), written: writtenUpset(style, en), expect: { action: 'reply', mood: 'upset' } },
      ] });
      // 4. In a hurry.
      out.push({ id: id('hurry'), ...base, kind: 'مستعجل', turns: [
        { said: say('hurried', talk, held, p), written: writtenPrice(p, style, en), expect: { action: 'reply', refer: p.name, mood: 'hurried' } },
      ] });
      // 5. Steps, then a change of topic.
      out.push({ id: id('steps'), ...base, kind: 'خطوات وتغيير موضوع', turns: [
        { said: say('steps', talk, held), written: writtenSteps(style, en), expect: { action: 'reply' } },
        { said: say('shipping', talk, held), written: writtenShipping(style, en), expect: { action: 'reply' } },
      ] });
      // 6. A comparison (a table on the page).
      const longer = p.hours >= q.hours ? p : q;
      const cheaper = p.price <= q.price ? p : q;
      out.push({ id: id('compare'), ...base, kind: 'مقارنة', turns: [
        { said: say('compare', talk, held, p, q), written: writtenCompare(p, q, style, en), expect: { action: 'reply', refer: en && held ? cheaper.name : longer.name } },
      ] });
    }
  });
  return out;
}

export const TALK_TRAINING: Drill[] = drills(false);
export const TALK_HELDOUT: Drill[] = drills(true);

// ── Exam 2 (written after the rules were tuned — first-sight score is the honest one) ─────────────────────────
// Other dialects (Iraqi, Sudanese, Yemeni, Egyptian, Gulf), other products, a third written style (emoji, «ملاحظة:»،
// «علاوة على ذلك»، «يُنصح بـ»، nested points), and two new kinds: a gift and a safety question.
const EXAM_PRODUCTS: Product[] = [
  { name: 'كشمير أبيض', price: 940, ml: 75, hours: 8, notes: ['مسك', 'كشمير', 'فانيليا'], family: 'ناعم دافئ', occasion: 'الهدايا' },
  { name: 'ليل القاهرة', price: 1150, ml: 100, hours: 9, notes: ['عود', 'بخور', 'ورد'], family: 'شرقي', occasion: 'السهرات' },
  { name: 'نعناع وليمون', price: 390, ml: 50, hours: 4, notes: ['نعناع', 'ليمون', 'ريحان'], family: 'منعش', occasion: 'الرياضة' },
  { name: 'عنبر ذهبي', price: 1600, ml: 100, hours: 11, notes: ['عنبر', 'زعفران', 'صندل'], family: 'شرقي فاخر', occasion: 'الأعراس' },
  { name: 'زهر البرتقال', price: 700, ml: 50, hours: 6, notes: ['زهر البرتقال', 'نيرولي', 'مسك'], family: 'زهري منعش', occasion: 'النهار' },
];
type ExamTalk = 'egyptian' | 'gulf' | 'iraqi' | 'sudanese' | 'yemeni';
const EXAM_SAYS: Record<string, Record<ExamTalk, string>> = {
  gift: { egyptian: 'عايز هدية لماما عيد ميلادها', gulf: 'أبي هدية لأمي بمناسبة عيد ميلادها', iraqi: 'أريد هدية لأمي عيد ميلادها', sudanese: 'داير هدية لأمي في عيد ميلادها', yemeni: 'أشتي هدية لأمي عيد ميلادها' },
  safety: { egyptian: 'ينفع أحط العطر على جلدي على طول؟', gulf: 'يصير أحط العطر على جلدي مباشرة؟', iraqi: 'يصير أخلي العطر على جلدي مباشرة؟', sudanese: 'ممكن أختّ العطر في جلدي طوالي؟', yemeni: 'يجوز أحط العطر على جلدي مباشرة؟' },
  which: { egyptian: 'وأنهي واحد فيهم أثبت؟', gulf: 'وأيهم أثبت؟', iraqi: 'وياهو الأثبت بيهم؟', sudanese: 'ياتو فيهم أثبت؟', yemeni: 'وأيش الأثبت فيهم؟' },
  phone: { egyptian: 'ألو أيوه يا حبيبي هكلمك بعدين', gulf: 'ألو هلا حبيبي بكلمك بعدين', iraqi: 'ألو هلو حبيبي أحاجيك بعدين', sudanese: 'ألو أيوه يا زول بكلمك بعدين', yemeni: 'ألو أهلين حبيبي باكلمك بعدين' },
  angry: { egyptian: 'العطر وصل مكسور وأنا متضايق جدا', gulf: 'العطر وصلني مكسور وأنا معصب', iraqi: 'العطر وصل مكسور وآني مقهور', sudanese: 'العطر جاني مكسور وأنا زعلان شديد', yemeni: 'العطر وصل مكسور وأنا متضايق' },
  more: { egyptian: 'ماشي كمل', gulf: 'ايه كمل', iraqi: 'إي كمل', sudanese: 'أيوه كمّل', yemeni: 'أيوه كمل' },
};
function writtenGift(items: Product[]): string {
  return `🎁 اختيار رائع! علاوة على ذلك، يُنصح بالعطور الناعمة للأمهات:\n\n${items.map((p) => `✅ **${p.name}**\n   - يتميز بطابع ${p.family}.\n   - السعر: ${ar(p.price)} جنيه.`).join('\n')}\n\n**ملاحظة:** يمكنك إضافة بطاقة إهداء مجانية. هل تودّ أن أساعدك في الاختيار؟`;
}
function writtenSafety(): string {
  return `سؤال مهم جداً! ⚠️\n\n**باختصار:** العطر الجاهز مصمم للرش على الجلد، ولكن يُنصح بما يلي:\n- تجنب رشه على الجلد المتهيج أو المجروح.\n- قم بتجربته على جزء صغير أولاً.\n- لا تضع الزيوت العطرية المركزة مباشرة على الجلد.\n\nفي الختام، إذا ظهرت أي حساسية فتوقف عن استخدامه فوراً.`;
}
function writtenWhich(a: Product, b: Product): string {
  const top = a.hours >= b.hours ? a : b;
  return `من حيث الثبات، فإن **${top.name}** هو الأثبت (حوالي ${top.hours} ساعات) 💪، بينما ${top === a ? b.name : a.name} يدوم ${top === a ? b.hours : a.hours} ساعات تقريباً.`;
}
function writtenBroken(): string {
  return `نحن نتفهم انزعاجك تماماً ونعتذر عن ذلك 🙏\n\n**الخطوات التالية:**\n1. يرجى تصوير المنتج والعبوة.\n2. أرسل الصور مع رقم الطلب.\n3. سيتم استبدال المنتج أو استرداد المبلغ حسب سياسة الإرجاع.`;
}
function examDrills(): Drill[] {
  const out: Drill[] = [];
  const talks: ExamTalk[] = ['egyptian', 'gulf', 'iraqi', 'sudanese', 'yemeni'];
  EXAM_PRODUCTS.forEach((p, n) => {
    const q = pick(EXAM_PRODUCTS, n + 1);
    const r = pick(EXAM_PRODUCTS, n + 3);
    for (const talk of talks) {
      const base = { language: 'ar' as const, dialect: talk as Dialect };
      const top = [p, q].reduce((x, y) => (y.hours > x.hours ? y : x));
      out.push({ id: `E-gift-${n}-${talk}`, ...base, kind: 'هدية ومكالمة ومقارنة', turns: [
        { said: EXAM_SAYS.gift![talk], written: writtenGift([p, q, r]), expect: { action: 'reply' } },
        { said: EXAM_SAYS.phone![talk], expect: { action: 'aside' } },
        { said: EXAM_SAYS.which![talk], written: writtenWhich(p, q), expect: { action: 'reply', refer: top.name } },
        { said: EXAM_SAYS.more![talk], expect: { action: 'more' } },
      ] });
      out.push({ id: `E-safety-${n}-${talk}`, ...base, kind: 'سؤال أمان', turns: [
        { said: EXAM_SAYS.safety![talk], written: writtenSafety(), expect: { action: 'reply' } },
      ] });
      out.push({ id: `E-broken-${n}-${talk}`, ...base, kind: 'عطر مكسور', turns: [
        { said: EXAM_SAYS.angry![talk], written: writtenBroken(), expect: { action: 'reply', mood: 'upset' } },
      ] });
    }
  });
  return out;
}
export const TALK_EXAM2: Drill[] = examDrills();

// ── Exam 3 (written last, after all tuning; scored once — never tune on it) ─────────────────────────────────
// A fourth written style (long paragraphs, «أولاً/ثانياً»، «كما أن»، «مما يجعل»، bold inline labels), new kinds
// (layering, originality, returns, «لا أنا قصدت التاني»), new products and wordings.
const EXAM3_PRODUCTS: Product[] = [
  { name: 'مسك الغزال', price: 520, ml: 30, hours: 7, notes: ['مسك', 'عنبر'], family: 'مسكي', occasion: 'كل يوم' },
  { name: 'ورد جوري', price: 830, ml: 50, hours: 6, notes: ['ورد', 'ليتشي'], family: 'زهري', occasion: 'الصيف' },
  { name: 'عود كمبودي', price: 1900, ml: 100, hours: 12, notes: ['عود', 'جلد', 'دخان'], family: 'خشبي', occasion: 'الشتاء' },
  { name: 'قهوة وهيل', price: 760, ml: 75, hours: 8, notes: ['قهوة', 'هيل', 'فانيليا'], family: 'حار', occasion: 'المساء' },
];
type Exam3Talk = 'egyptian' | 'gulf' | 'levantine';
const EXAM3_SAYS: Record<string, Record<Exam3Talk, string>> = {
  layer: { egyptian: 'ينفع أحط {p} فوق {q}؟', gulf: 'ينفع أخلط {p} مع {q}؟', levantine: 'فيني حط {p} فوق {q}؟' },
  original: { egyptian: 'هو {p} ده أصلي؟', gulf: 'هل {p} أصلي؟', levantine: '{p} أصلي ولا تقليد؟' },
  returns: { egyptian: 'لو مش عجبني أقدر أرجعه؟', gulf: 'إذا ما عجبني أقدر أرجعه؟', levantine: 'إذا ما عجبني فيني رجعه؟' },
  other: { egyptian: 'لا أنا قصدت التاني', gulf: 'لا قصدي الثاني', levantine: 'لا قصدي التاني' },
};
function writtenLayer(p: Product, q: Product): string {
  return `نعم، يمكنك ذلك بالتأكيد. أولاً، يُفضّل رش **${p.name}** أولاً لأنه أثقل، ثانياً، أضف **${q.name}** فوقه بكمية قليلة. كما أن هذا المزج يمنحك رائحة ${p.family} مع لمسة ${q.family}، مما يجعل العطر أكثر تميزاً وثباتاً.`;
}
function writtenOriginal(p: Product): string {
  return `**الإجابة المختصرة:** نعم، ${p.name} منتج أصلي 100%. **التفاصيل:** جميع منتجاتنا يتم توريدها من موردين معتمدين، كما أن كل عبوة تأتي مختومة. لذا يمكنك الشراء بثقة تامة.`;
}
function writtenReturns(): string {
  return `بالطبع! وفقاً لسياسة الإرجاع لدينا، يمكنك إرجاع المنتج خلال 14 يوماً بشرط أن يكون مختوماً ولم يتم استخدامه. أما إذا تم فتح العبوة، فللأسف لا يمكن إرجاعها لأسباب صحية.`;
}
function writtenOther(p: Product): string {
  return `آه، تقصد **${p.name}**! حسناً، ${p.name} يتميز بطابع ${p.family}، ويدوم حوالي ${p.hours} ساعات، وسعره ${ar(p.price)} جنيه.`;
}
function exam3Drills(): Drill[] {
  const out: Drill[] = [];
  const talks: Exam3Talk[] = ['egyptian', 'gulf', 'levantine'];
  EXAM3_PRODUCTS.forEach((p, n) => {
    const q = pick(EXAM3_PRODUCTS, n + 1);
    for (const talk of talks) {
      const base = { language: 'ar' as const, dialect: talk as Dialect };
      const fill = (kind: string) => EXAM3_SAYS[kind]![talk].replace('{p}', p.name).replace('{q}', q.name);
      out.push({ id: `X-layer-${n}-${talk}`, ...base, kind: 'طبقات وتصحيح', turns: [
        { said: fill('layer'), written: writtenLayer(p, q), expect: { action: 'reply', refer: p.name } },
        { said: fill('other'), written: writtenOther(q), expect: { action: 'reply', refer: q.name } },
      ] });
      out.push({ id: `X-original-${n}-${talk}`, ...base, kind: 'أصلي وإرجاع', turns: [
        { said: fill('original'), written: writtenOriginal(p), expect: { action: 'reply', refer: p.name } },
        { said: fill('returns'), written: writtenReturns(), expect: { action: 'reply' } },
      ] });
    }
  });
  return out;
}
export const TALK_EXAM3: Drill[] = exam3Drills();
