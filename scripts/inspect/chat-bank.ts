/**
 * The question bank for the intensive chat inspection: "ask about anything".
 * `live` = the honest answer changes by the day, so the chat must search the web by itself.
 */
export interface BankQuestion { topic: string; text: string; live: boolean }

const q = (topic: string, live: boolean, ...texts: string[]): BankQuestion[] => texts.map((text) => ({ topic, text, live }));

export const CHAT_BANK: BankQuestion[] = [
  ...q('news', true,
    'ايه اخبار الحرب فى الشرق الاوسط انهارده', 'إيه آخر أخبار مصر؟', 'ما آخر تطورات الهدنة في غزة؟', 'حصل ايه في السودان النهارده؟',
    'عاجل: ايه اللي حصل في لبنان', 'what is the latest news on the war in Ukraine', 'any breaking news today?', 'مين كسب الانتخابات الأمريكية؟',
    'في زلزال حصل النهارده؟', 'top headlines this week'),
  ...q('money', true,
    'سعر الدولار النهارده كام', 'سعر الذهب عيار 21 دلوقتي', 'بكام الدولار في البنك', 'what is the gold price today', 'bitcoin price right now', 'أخبار البورصة المصرية'),
  ...q('weather-sport', true,
    'حالة الطقس في القاهرة بكرة', 'درجة الحرارة في الإسكندرية النهارده كام', 'نتيجة مباراة الأهلي والزمالك', 'مين فاز في ماتش امبارح', 'weather in Dubai', 'who won the match last night'),
  ...q('science', false,
    'ليه السما لونها أزرق؟', 'اشرحلي الثقب الأسود ببساطة', 'ما الفرق بين الفيروس والبكتيريا؟', 'how does photosynthesis work', 'ازاي الطيارة بتطير؟'),
  ...q('maths', false,
    'حل المعادلة 2س + 6 = 20', 'كام 15% من 480؟', 'what is the derivative of x squared', 'اشرح نظرية فيثاغورس بمثال'),
  ...q('religion', false,
    'ما هي أركان الإسلام؟', 'اشرحلي معنى سورة الفاتحة', 'إزاي أصلي صلاة الاستخارة؟'),
  ...q('history-geo', false,
    'مين بنى الهرم الأكبر؟', 'عاصمة أستراليا ايه؟', 'امتى كانت حرب أكتوبر؟', 'who was Saladin'),
  ...q('cooking', false,
    'طريقة عمل الكشري المصري', 'ازاي أعمل محشي ورق عنب؟', 'recipe for hummus'),
  ...q('code', false,
    'اكتبلي كود بايثون يرتب قائمة أرقام', 'اعملي صفحة HTML فيها زرار يعد الضغطات', 'ايه الفرق بين let و const في جافاسكريبت؟', 'write a SQL query to find duplicate emails'),
  ...q('writing', false,
    'اكتبلي إيميل اعتذار عن التأخير', 'ترجم "صباح الخير يا صديقي" للإنجليزي', 'لخصلي الفرق بين التسويق والمبيعات', 'اكتب منشور عن عروض اليوم الوطني', 'write a short poem about the sea'),
  ...q('perfume', false,
    'ايه الفرق بين العود والمسك؟', 'رشحلي عطر صيفي رجالي', 'العطر بيثبت قد ايه على الجلد؟', 'what are top, heart and base notes'),
  ...q('health-life', false,
    'ازاي أنام بدري؟', 'نصايح للمذاكرة قبل الامتحان', 'تمارين بسيطة للضهر في البيت'),
  ...q('business', false,
    'ازاي أعمل دراسة جدوى لمحل عطور؟', 'اكتب خطة تسويق لمتجر أونلاين', 'ايه هي القيمة المضافة؟'),
];
