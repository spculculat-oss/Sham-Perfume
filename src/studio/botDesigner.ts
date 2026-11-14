/**
 * «استوديو شاهين» — robot designer: the owner (or any visitor) designs a chat robot for his own site — customer
 * service, sales, bookings, questions & answers, a tutor, or free — gives it a name, a look, a tone, its answers and
 * the details it should collect (a booking, an order), tries it here, and downloads it as ONE script that works on any
 * website with no server, no AI key, no tracking and nothing stored: it answers from its own questions (understanding
 * Arabic spelling variants and small typos), collects the details step by step, and hands the visitor to a human on
 * WhatsApp or e-mail with everything already written. A ready instruction text is included for whoever wants to
 * connect it to an AI platform later.
 *
 * `botEngine` is written without imports or outside helpers on purpose: the very same function runs here and is
 * copied into the downloaded script, so what the owner tries is exactly what his visitors get.
 */
import { jsonFrom } from './siteSpec';

export type BotKind = 'support' | 'sales' | 'booking' | 'faq' | 'tutor' | 'custom';
export const BOT_KINDS: BotKind[] = ['support', 'sales', 'booking', 'faq', 'tutor', 'custom'];
export type BotTone = 'friendly' | 'formal' | 'fun' | 'expert';
export const BOT_TONES: BotTone[] = ['friendly', 'formal', 'fun', 'expert'];
export type FieldKind = 'text' | 'phone' | 'email' | 'date';

export interface BotFaq { q: string; a: string }
export interface BotField { label: string; kind: FieldKind }
export interface BotSpec {
  name: string; avatar: string; color: string; kind: BotKind; tone: BotTone; rtl: boolean;
  role: string; greeting: string; rules: string[]; faq: BotFaq[]; quick: string[];
  collect: { trigger: string; fields: BotField[]; done: string };
  handoff: { whatsapp: string; email: string; label: string };
  texts: { fallback: string; invalid: string; cancelled: string; placeholder: string; send: string; human: string };
}
export interface BotState { step: number; answers: string[] }
export interface BotTurn { text: string; state: BotState; link?: string; linkLabel?: string }

/** The robot's brain — self-contained (copied as is into the downloaded script). */
export function botEngine(spec: BotSpec, message: string, state: BotState | null): BotTurn {
  const norm = (s: string) => String(s || '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\p{L}\p{N}@.+\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const STOP = ['في', 'من', 'على', 'عن', 'هل', 'ما', 'ايه', 'ازاي', 'انا', 'انت', 'هو', 'هي', 'و', 'يا', 'اللي', 'ده', 'دي', 'دا', 'مع', 'لو', 'بس', 'كده', 'عايز', 'عاوز', 'ممكن', 'the', 'a', 'an', 'is', 'are', 'do', 'does', 'to', 'of', 'in', 'on', 'for', 'what', 'how', 'i', 'you', 'my', 'your', 'can', 'me', 'please', 'it'];
  const toks = (s: string) => norm(s).split(' ').map((t) => (t.length > 4 ? t.replace(/^(وال|بال|فال|كال|لل|ال)/, '') : t.replace(/^ال/, ''))).filter((t) => t.length > 1 && STOP.indexOf(t) < 0);
  const near = (a: string, b: string) => {
    if (a === b) return true;
    if (a.length < 4 || b.length < 4) return false;
    if (a.indexOf(b) === 0 || b.indexOf(a) === 0) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0; let j = 0; let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };
  const link = (text: string) => {
    const wa = String(spec.handoff.whatsapp || '').replace(/\D/g, '');
    if (wa.length >= 8) return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
    const mail = String(spec.handoff.email || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return 'mailto:' + mail + '?subject=' + encodeURIComponent(spec.name) + '&body=' + encodeURIComponent(text);
    return '';
  };
  const withLink = (text: string, st: BotState, body: string): BotTurn => {
    const href = link(body);
    return href ? { text: text, state: st, link: href, linkLabel: spec.handoff.label } : { text: text, state: st };
  };
  const idle: BotState = { step: -1, answers: [] };
  const fields = spec.collect && spec.collect.fields ? spec.collect.fields : [];
  const msg = String(message || '').trim();
  const st: BotState = state && typeof state.step === 'number' ? { step: state.step, answers: (state.answers || []).slice() } : { step: -1, answers: [] };

  // In the middle of collecting details (a booking, an order).
  if (st.step >= 0 && st.step < fields.length) {
    if (/^(الغاء|cancel|stop|خلاص|مش عايز|لا شكرا)$/.test(norm(msg))) return { text: spec.texts.cancelled, state: idle };
    const field = fields[st.step]!;
    const digits = msg.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
    const ok = field.kind === 'phone' ? digits.length >= 7 && digits.length <= 15
      : field.kind === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg) : msg.length > 0;
    if (!ok) return { text: spec.texts.invalid + ' ' + field.label, state: st };
    st.answers.push(field.kind === 'phone' ? digits : msg.slice(0, 300));
    st.step++;
    if (st.step < fields.length) return { text: fields[st.step]!.label, state: st };
    const summary = fields.map((f, i) => f.label.replace(/[؟?:：]\s*$/, '') + ': ' + st.answers[i]).join('\n');
    return withLink(spec.collect.done + '\n\n' + summary, idle, spec.name + '\n' + summary);
  }
  if (!msg) return { text: spec.greeting, state: idle };
  const said = norm(msg);
  const words = toks(msg);

  // Asking for a person.
  if (/(انسان|بني ادم|موظف|حد يكلمني|حد يرد|خدمه العملاء|كلم حد|human|agent|real person|someone)/.test(said)) {
    return withLink(spec.texts.human, idle, spec.name + '\n' + msg);
  }
  // Starting the booking / order.
  if (fields.length) {
    const triggers = String(spec.collect.trigger || '').split(/[,،;\n]/).map((t) => norm(t)).filter(Boolean);
    if (triggers.some((t) => said.indexOf(t) >= 0 || toks(t).some((x) => words.some((y) => near(x, y))))) {
      return { text: fields[0]!.label, state: { step: 0, answers: [] } };
    }
  }
  // The best matching question.
  let best: BotFaq | null = null; let bestScore = 0;
  for (const f of spec.faq || []) {
    const q = toks(f.q);
    if (!q.length) continue;
    let hit = 0;
    for (const x of q) if (words.some((y) => near(x, y))) hit++;
    const score = hit / Math.sqrt(q.length * Math.max(1, words.length));
    if (score > bestScore) { bestScore = score; best = f; }
  }
  if (best && bestScore >= 0.34) return { text: best.a, state: idle };
  // A hello.
  if (/^(اهلا|هلا|مرحبا|السلام|سلام|هاي|ازيك|صباح|مساء|hi|hello|hey|good (morning|evening))/.test(said) && words.length <= 4) return { text: spec.greeting, state: idle };
  return withLink(spec.texts.fallback, idle, spec.name + '\n' + msg);
}

const T = {
  ar: {
    fallback: 'مش متأكد إني فهمت سؤالك. ممكن تكتبه بشكل تاني، أو تكلم حد من الفريق.', invalid: 'المكتوب مش مظبوط، اكتب تاني من فضلك:', cancelled: 'تمام، اتلغى. لو احتجت أي حاجة أنا هنا.',
    placeholder: 'اكتب رسالتك…', send: 'ابعت', human: 'أكيد، اضغط على الزرار وهتكلم حد من الفريق على طول.', label: 'كلّم الفريق',
  },
  en: {
    fallback: 'I am not sure I understood. Could you put it another way, or talk to someone from the team?', invalid: 'That does not look right, please try again:', cancelled: 'Okay, cancelled. I am here if you need anything.',
    placeholder: 'Type your message…', send: 'Send', human: 'Sure — tap the button to talk to someone from the team right away.', label: 'Talk to the team',
  },
};

/** A ready robot of each kind (Arabic or English), with honest placeholder answers the owner fills in. */
export function botTemplate(kind: BotKind, rtl: boolean, name = ''): BotSpec {
  const ar = rtl;
  const t = ar ? T.ar : T.en;
  const nm = name.trim() || (ar ? 'مساعد' : 'Assistant');
  const base = {
    name: nm, avatar: '🤖', color: '#8a5a2b', kind, tone: 'friendly' as BotTone, rtl,
    rules: ar ? ['ما تخترعش أسعار أو مواعيد أو عروض مش مكتوبة.', 'لو مش عارف الإجابة، حوّل للفريق.'] : ['Never invent prices, dates or offers that are not written here.', 'If you do not know, hand over to the team.'],
    handoff: { whatsapp: '', email: '', label: t.label },
    texts: { fallback: t.fallback, invalid: t.invalid, cancelled: t.cancelled, placeholder: t.placeholder, send: t.send, human: t.human },
  };
  const ask = (q: string, a: string): BotFaq => ({ q, a });
  const none = { trigger: '', fields: [] as BotField[], done: '' };
  switch (kind) {
    case 'booking': return {
      ...base, avatar: '📅', role: ar ? 'بياخد الحجوزات ويرد على أسئلة المواعيد.' : 'Takes bookings and answers questions about times.',
      greeting: ar ? `أهلاً بيك! أنا ${nm}. تحب تحجز ميعاد ولا عندك سؤال؟` : `Hi! I am ${nm}. Would you like to book, or do you have a question?`,
      quick: ar ? ['احجز ميعاد', 'المواعيد إيه؟', 'العنوان فين؟'] : ['Book an appointment', 'Opening hours?', 'Where are you?'],
      faq: ar ? [ask('المواعيد إيه؟ بتفتحوا امتى؟', 'اكتب هنا مواعيد العمل الحقيقية.'), ask('العنوان فين؟ المكان', 'اكتب هنا العنوان الحقيقي.')] : [ask('What are your opening hours?', 'Write your real opening hours here.'), ask('Where are you located? address', 'Write your real address here.')],
      collect: { trigger: ar ? 'احجز، حجز، ميعاد، موعد' : 'book, booking, appointment, reserve', fields: ar ? [{ label: 'تمام! اسمك إيه؟', kind: 'text' }, { label: 'رقم تليفونك؟', kind: 'phone' }, { label: 'اليوم والوقت اللي يناسبك؟', kind: 'date' }] : [{ label: 'Great! What is your name?', kind: 'text' }, { label: 'Your phone number?', kind: 'phone' }, { label: 'Which day and time suit you?', kind: 'date' }], done: ar ? 'تمام، ده ملخص حجزك. اضغط الزرار عشان يوصل للفريق ويأكدولك:' : 'Here is your booking. Tap the button to send it to the team for confirmation:' },
    };
    case 'sales': return {
      ...base, avatar: '🛍️', role: ar ? 'بيعرّف الزوار بالمنتجات وبياخد الطلبات.' : 'Introduces the products and takes orders.',
      greeting: ar ? `أهلاً! أنا ${nm}. بتدور على إيه النهارده؟` : `Hello! I am ${nm}. What are you looking for today?`,
      quick: ar ? ['عايز أطلب', 'الأسعار', 'التوصيل'] : ['I want to order', 'Prices', 'Delivery'],
      faq: ar ? [ask('الأسعار كام؟ بكام', 'اكتب هنا الأسعار الحقيقية أو رابط صفحة المنتجات.'), ask('التوصيل بياخد قد إيه؟ شحن', 'اكتب هنا مدة وتكلفة التوصيل الحقيقية.'), ask('الدفع إزاي؟', 'اكتب هنا طرق الدفع المتاحة.')] : [ask('What are the prices?', 'Write your real prices here, or a link to the products page.'), ask('How long does delivery take? shipping', 'Write your real delivery time and cost here.'), ask('How can I pay?', 'Write the payment methods you accept here.')],
      collect: { trigger: ar ? 'اطلب، طلب، اشتري، عايز أطلب' : 'order, buy, purchase', fields: ar ? [{ label: 'تحب تطلب إيه؟', kind: 'text' }, { label: 'اسمك؟', kind: 'text' }, { label: 'رقم تليفونك؟', kind: 'phone' }, { label: 'العنوان؟', kind: 'text' }] : [{ label: 'What would you like to order?', kind: 'text' }, { label: 'Your name?', kind: 'text' }, { label: 'Your phone number?', kind: 'phone' }, { label: 'Delivery address?', kind: 'text' }], done: ar ? 'ده ملخص طلبك. اضغط الزرار عشان يوصل للفريق:' : 'Here is your order. Tap the button to send it to the team:' },
    };
    case 'support': return {
      ...base, avatar: '🎧', role: ar ? 'بيرد على أسئلة العملاء ومشاكلهم.' : 'Answers customers’ questions and problems.',
      greeting: ar ? `أهلاً بيك، أنا ${nm}. أقدر أساعدك في إيه؟` : `Hi, I am ${nm}. How can I help you?`,
      quick: ar ? ['تتبع طلبي', 'استرجاع', 'كلّم موظف'] : ['Track my order', 'Returns', 'Talk to a person'],
      faq: ar ? [ask('أتابع طلبي إزاي؟ تتبع الطلب', 'اكتب هنا طريقة تتبع الطلب.'), ask('ينفع أرجّع أو أستبدل؟ استرجاع', 'اكتب هنا سياسة الاسترجاع الحقيقية.')] : [ask('How do I track my order?', 'Write how customers track orders here.'), ask('Can I return or exchange? returns', 'Write your real return policy here.')],
      collect: { trigger: ar ? 'شكوى، مشكلة' : 'complaint, problem, issue', fields: ar ? [{ label: 'اسمك؟', kind: 'text' }, { label: 'رقم تليفونك أو رقم الطلب؟', kind: 'text' }, { label: 'احكيلي المشكلة باختصار:', kind: 'text' }] : [{ label: 'Your name?', kind: 'text' }, { label: 'Your phone or order number?', kind: 'text' }, { label: 'Tell me the problem briefly:', kind: 'text' }], done: ar ? 'وصلت. اضغط الزرار عشان الفريق يتابع معاك:' : 'Got it. Tap the button so the team can follow up:' },
    };
    case 'tutor': return {
      ...base, avatar: '🎓', tone: 'expert', role: ar ? 'بيشرح الدروس ويرد على أسئلة الطلبة.' : 'Explains lessons and answers students’ questions.',
      greeting: ar ? `أهلاً! أنا ${nm}. عايز تفهم إيه النهارده؟` : `Hi! I am ${nm}. What would you like to learn today?`,
      quick: ar ? ['مواعيد الحصص', 'الاشتراك'] : ['Class times', 'Join'],
      faq: ar ? [ask('مواعيد الحصص إيه؟', 'اكتب هنا مواعيد الحصص.'), ask('أشترك إزاي؟', 'اكتب هنا طريقة الاشتراك.')] : [ask('When are the classes?', 'Write the class times here.'), ask('How do I join?', 'Write how to join here.')],
      collect: { trigger: ar ? 'اشترك، اشتراك، احجز حصة' : 'join, enrol, sign up', fields: ar ? [{ label: 'اسم الطالب؟', kind: 'text' }, { label: 'السنة الدراسية؟', kind: 'text' }, { label: 'رقم التليفون؟', kind: 'phone' }] : [{ label: 'Student name?', kind: 'text' }, { label: 'Year / level?', kind: 'text' }, { label: 'Phone number?', kind: 'phone' }], done: ar ? 'تمام! اضغط الزرار عشان نأكد الاشتراك:' : 'Great! Tap the button to confirm:' },
    };
    case 'faq': return {
      ...base, avatar: '💡', role: ar ? 'بيرد على الأسئلة المتكررة بس.' : 'Answers the frequent questions only.',
      greeting: ar ? `أهلاً! أنا ${nm}. اسألني أي سؤال.` : `Hi! I am ${nm}. Ask me anything.`,
      quick: ar ? ['المواعيد', 'العنوان', 'التواصل'] : ['Hours', 'Address', 'Contact'],
      faq: ar ? [ask('المواعيد إيه؟', 'اكتب هنا المواعيد.'), ask('العنوان فين؟', 'اكتب هنا العنوان.'), ask('أتواصل معاكم إزاي؟', 'اكتب هنا طرق التواصل.')] : [ask('What are your hours?', 'Write your hours here.'), ask('Where are you?', 'Write your address here.'), ask('How can I contact you?', 'Write your contact details here.')],
      collect: none,
    };
    default: return {
      ...base, role: ar ? 'اكتب هنا وظيفة الروبوت.' : 'Describe the robot’s job here.',
      greeting: ar ? `أهلاً! أنا ${nm}. أقدر أساعدك إزاي؟` : `Hi! I am ${nm}. How can I help?`,
      quick: [], faq: [], collect: none,
    };
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000B-\u001F]/g, '').trim().slice(0, max) : '');
const pick = <K extends string>(v: unknown, list: readonly K[], fallback: K): K => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as K : fallback);
const FIELD_KINDS: FieldKind[] = ['text', 'phone', 'email', 'date'];

/** Anything (the AI's JSON, a saved draft, the form) made into a safe, complete robot. */
export function cleanBot(raw: unknown, base: BotSpec): BotSpec {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rec = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
  const c = rec(o.collect); const h = rec(o.handoff); const tx = rec(o.texts);
  const list = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : undefined);
  const faq = Array.isArray(o.faq) ? o.faq.map((f) => ({ q: str(rec(f).q, 200), a: str(rec(f).a, 1200) })).filter((f) => f.q && f.a).slice(0, 40) : base.faq;
  const fields = Array.isArray(c.fields) ? c.fields.map((f) => ({ label: str(rec(f).label, 120), kind: pick(rec(f).kind, FIELD_KINDS, 'text') })).filter((f) => f.label).slice(0, 8) : base.collect.fields;
  const email = str(h.email, 120);
  return {
    name: str(o.name, 40) || base.name,
    avatar: [...str(o.avatar, 12)].slice(0, 2).join('') || base.avatar,
    color: typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color.toLowerCase() : base.color,
    kind: pick(o.kind, BOT_KINDS, base.kind),
    tone: pick(o.tone, BOT_TONES, base.tone),
    rtl: typeof o.rtl === 'boolean' ? o.rtl : base.rtl,
    role: str(o.role, 400) || base.role,
    greeting: str(o.greeting, 400) || base.greeting,
    rules: list(o.rules, 20, 300) || base.rules,
    faq,
    quick: list(o.quick, 6, 40) || base.quick,
    collect: { trigger: typeof c.trigger === 'string' ? str(c.trigger, 200) : base.collect.trigger, fields, done: str(c.done, 300) || base.collect.done },
    handoff: {
      whatsapp: typeof h.whatsapp === 'string' ? h.whatsapp.replace(/\D/g, '').slice(0, 15) : base.handoff.whatsapp,
      email: typeof h.email === 'string' ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '') : base.handoff.email,
      label: str(h.label, 40) || base.handoff.label,
    },
    texts: {
      fallback: str(tx.fallback, 300) || base.texts.fallback, invalid: str(tx.invalid, 200) || base.texts.invalid, cancelled: str(tx.cancelled, 200) || base.texts.cancelled,
      placeholder: str(tx.placeholder, 60) || base.texts.placeholder, send: str(tx.send, 20) || base.texts.send, human: str(tx.human, 300) || base.texts.human,
    },
  };
}

/** Without the AI: the description picks the kind, the name and the contact; the rest comes from the template. */
export function localBot(idea: string, rtl: boolean): BotSpec {
  const text = idea.replace(/\s+/g, ' ').trim();
  const kind: BotKind = /حجز|حجوزات|ميعاد|مواعيد|عياد|صالون|مطعم|booking|appointment|reserv|clinic|salon/i.test(text) ? 'booking'
    : /بيع|مبيعات|طلبات|اوردر|أوردر|متجر|منتجات|محل|sales|order|shop|store/i.test(text) ? 'sales'
      : /دعم|شكاوى|شكوى|خدمة عملاء|support|complain|help ?desk/i.test(text) ? 'support'
        : /مدرس|مدرّس|تعليم|دروس|حصص|طلبة|طلاب|tutor|teach|lesson|course|student/i.test(text) ? 'tutor'
          : /أسئلة|اسئلة|استفسارات|faq|questions/i.test(text) ? 'faq' : 'custom';
  const name = text.match(/[«"“]([^»"”]{2,30})[»"”]/)?.[1] || text.match(/(?:اسمه|اسمها|named|called)\s+([\p{L}\p{N}_-]{2,24})/iu)?.[1] || '';
  const bot = botTemplate(kind, rtl, name);
  const phone = text.match(/\+?\d[\d\s-]{7,}\d/)?.[0]?.replace(/\D/g, '');
  const email = text.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0];
  if (kind === 'custom') bot.role = text.slice(0, 400);
  if (phone) bot.handoff.whatsapp = phone.startsWith('0') && phone.length === 11 ? `2${phone}` : phone;
  if (email) bot.handoff.email = email;
  return bot;
}

/** The AI's reply (JSON) → a robot, keeping what it did not mention. */
export function botFromReply(reply: string, current: BotSpec): BotSpec | undefined {
  const data = jsonFrom(reply);
  if (!data || typeof data !== 'object') return undefined;
  const next = cleanBot(data, current);
  return next.greeting ? next : undefined;
}

const TONES_AR: Record<BotTone, string> = { friendly: 'ودود وبسيط', formal: 'رسمي ومحترم', fun: 'خفيف الدم من غير مبالغة', expert: 'خبير وبيشرح بوضوح' };
const TONES_EN: Record<BotTone, string> = { friendly: 'friendly and simple', formal: 'formal and polite', fun: 'light-hearted, never over the top', expert: 'expert, explains clearly' };
/** The robot as instructions for an AI platform (for whoever connects it to one later). */
export function botPrompt(bot: BotSpec): string {
  const ar = bot.rtl;
  const faq = bot.faq.map((f) => `- ${f.q}\n  ${f.a}`).join('\n');
  const fields = bot.collect.fields.map((f) => f.label).join(' / ');
  const contact = [bot.handoff.whatsapp && `WhatsApp +${bot.handoff.whatsapp}`, bot.handoff.email].filter(Boolean).join(' · ');
  return ar
    ? `إنت «${bot.name}». وظيفتك: ${bot.role}\nأسلوبك: ${TONES_AR[bot.tone]}. رد بلغة الزائر وباختصار.\nأول جملة: ${bot.greeting}\nالقواعد:\n${bot.rules.map((r) => `- ${r}`).join('\n')}\n- ما تخترعش أي معلومة مش مكتوبة هنا؛ لو مش عارف قول كده وحوّل للفريق.\n${faq ? `المعلومات اللي تعرفها:\n${faq}\n` : ''}${fields ? `لو الزائر عايز (${bot.collect.trigger}) اسأله واحدة واحدة: ${fields}، وبعدها لخّص اللي قاله.\n` : ''}${contact ? `التواصل مع الفريق: ${contact}\n` : ''}`
    : `You are “${bot.name}”. Your job: ${bot.role}\nTone: ${TONES_EN[bot.tone]}. Reply in the visitor’s language, briefly.\nFirst line: ${bot.greeting}\nRules:\n${bot.rules.map((r) => `- ${r}`).join('\n')}\n- Never invent anything that is not written here; if you do not know, say so and hand over to the team.\n${faq ? `What you know:\n${faq}\n` : ''}${fields ? `If the visitor wants to (${bot.collect.trigger}), ask one at a time: ${fields}, then summarise the answers.\n` : ''}${contact ? `Team contact: ${contact}\n` : ''}`;
}

const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** The robot as ONE script for any website: `<script src="robot.js" defer></script>` before </body>. */
/** The engine's own source, as copied into the downloaded script. */
export const botEngineSource = () => botEngine.toString();

export function botScript(bot: BotSpec): string {
  const engine = botEngineSource();
  return `/* ${bot.name.replace(/[<>*/\\]/g, '')} — made in Shaheen Studio. Works on any site: no server, no key, nothing stored or sent anywhere. */
(function () {
  if (window.__shaheenBot) return; window.__shaheenBot = true;
  var __name = function (f) { return f; }; // some build tools wrap inner functions with this helper
  var SPEC = ${safeJson(bot)};
  var engine = (${engine});
  var state = null, opened = false;
  var css = '.shb-btn{position:fixed;bottom:20px;' + (SPEC.rtl ? 'left' : 'right') + ':20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;font-size:28px;color:#fff;background:' + SPEC.color + ';box-shadow:0 10px 30px -8px rgba(0,0,0,.45)}'
    + '.shb-box{position:fixed;bottom:92px;' + (SPEC.rtl ? 'left' : 'right') + ':20px;z-index:2147483000;width:min(370px,calc(100vw - 32px));height:min(540px,calc(100vh - 120px));display:none;flex-direction:column;background:#fff;color:#1c1917;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px -12px rgba(0,0,0,.45);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}'
    + '.shb-box.open{display:flex}.shb-head{display:flex;align-items:center;gap:10px;padding:14px 16px;color:#fff;background:' + SPEC.color + '}.shb-head b{font-size:16px}.shb-x{margin-inline-start:auto;background:none;border:0;color:#fff;font-size:22px;cursor:pointer}'
    + '.shb-log{flex:1;overflow-y:auto;padding:14px;background:#f6f5f4;display:flex;flex-direction:column;gap:8px}.shb-m{max-width:85%;padding:9px 13px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}'
    + '.shb-bot{align-self:flex-start;background:#fff;border:1px solid #e7e5e4}.shb-me{align-self:flex-end;background:' + SPEC.color + ';color:#fff}.shb-link{align-self:flex-start;display:inline-block;padding:9px 14px;border-radius:12px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700}'
    + '.shb-quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0;background:#f6f5f4}.shb-q{border:1px solid ' + SPEC.color + ';color:' + SPEC.color + ';background:#fff;border-radius:99px;padding:5px 12px;cursor:pointer;font:inherit;font-size:13px}'
    + '.shb-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e7e5e4;background:#fff}.shb-in{flex:1;border:1px solid #d6d3d1;border-radius:12px;padding:10px 12px;font:inherit;min-width:0}.shb-send{border:0;border-radius:12px;padding:0 16px;font:inherit;font-weight:700;color:#fff;background:' + SPEC.color + ';cursor:pointer}';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function start() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);
    var btn = el('button', 'shb-btn', SPEC.avatar); btn.type = 'button'; btn.setAttribute('aria-label', SPEC.name);
    var box = el('div', 'shb-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', SPEC.name); box.dir = SPEC.rtl ? 'rtl' : 'ltr';
    var head = el('div', 'shb-head'); head.appendChild(el('span', '', SPEC.avatar)); head.appendChild(el('b', '', SPEC.name));
    var x = el('button', 'shb-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'close'); head.appendChild(x);
    var log = el('div', 'shb-log'); log.setAttribute('aria-live', 'polite');
    var quick = el('div', 'shb-quick');
    var form = el('form', 'shb-form'); var input = el('input', 'shb-in'); input.placeholder = SPEC.texts.placeholder; input.setAttribute('aria-label', SPEC.texts.placeholder); input.maxLength = 500;
    var send = el('button', 'shb-send', SPEC.texts.send); send.type = 'submit'; form.appendChild(input); form.appendChild(send);
    box.appendChild(head); box.appendChild(log); box.appendChild(quick); box.appendChild(form);
    document.body.appendChild(box); document.body.appendChild(btn);
    function say(turn) {
      log.appendChild(el('div', 'shb-m shb-bot', turn.text));
      if (turn.link && /^(https:\\/\\/wa\\.me\\/|mailto:)/.test(turn.link)) { var a = el('a', 'shb-link', turn.linkLabel || '↗'); a.href = turn.link; a.target = '_blank'; a.rel = 'noopener'; log.appendChild(a); }
      log.scrollTop = log.scrollHeight;
    }
    function ask(text) {
      text = String(text || '').trim(); if (!text) return;
      log.appendChild(el('div', 'shb-m shb-me', text));
      var turn = engine(SPEC, text, state); state = turn.state;
      setTimeout(function () { say(turn); }, 250);
    }
    (SPEC.quick || []).forEach(function (q) { var b = el('button', 'shb-q', q); b.type = 'button'; b.onclick = function () { ask(q); }; quick.appendChild(b); });
    function toggle(open) { opened = open; box.classList.toggle('open', open); if (open) { if (!log.childNodes.length) say(engine(SPEC, '', null)); input.focus(); } }
    btn.onclick = function () { toggle(!opened); }; x.onclick = function () { toggle(false); };
    form.onsubmit = function (e) { e.preventDefault(); ask(input.value); input.value = ''; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
`;
}

/** A page that shows the robot working, with the one line to add it to any site. */
export function botDemoPage(bot: BotSpec): string {
  const name = bot.name.replace(/[<>&"]/g, '');
  const ar = bot.rtl;
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.7 system-ui,Tahoma,sans-serif;background:#faf8f5;color:#1c1917}main{max-width:620px;padding:24px}code{display:block;direction:ltr;text-align:left;background:#1c1917;color:#fde68a;padding:12px;border-radius:10px;white-space:pre-wrap}</style>
</head>
<body><main>
<h1>${bot.avatar} ${name}</h1>
<p>${ar ? 'الروبوت شغال: اضغط على الدايرة اللي تحت. عشان تحطه في أي موقع، ارفع ملف robot.js جنب صفحات الموقع وضيف السطر ده قبل &lt;/body&gt;:' : 'The robot is live: tap the circle at the bottom. To add it to any site, upload robot.js next to the site’s pages and add this line before &lt;/body&gt;:'}</p>
<code>&lt;script src="robot.js" defer&gt;&lt;/script&gt;</code>
</main>
<script>
${botScript(bot)}
</script>
</body></html>`;
}
