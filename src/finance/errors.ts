/**
 * «قاموس أخطاء الدفع» — every code the money path can return, in the visitor's words and the owner's.
 *
 * Why it exists (owner's request, 2026-10-26 — a full, strict audit of the payment machinery and the mistakes
 * we keep falling into): an error code on its own is a dead end. Here each code carries
 *   · **what the visitor sees** (plain Arabic and English — no «error 422»),
 *   · **what actually happened** (the owner's explanation),
 *   · **the fix** (what the robot, or the merchant, must do — never «try again» alone),
 *   · who owns it: the visitor, the merchant, the gateway, or one of our robots.
 *
 * `explainFault()` never invents: an unknown code is reported as unknown (`tests/shaheenGuard.test.ts` proves every
 * code in the money path is in this table, so a new error can never ship unexplained).
 */
export type FaultOwner = 'visitor' | 'merchant' | 'gateway' | 'robot';

export interface Fault {
  code: string;
  /** What the visitor is told, in his language. */
  ar: string;
  en: string;
  /** What really happened — for the owner and the robots. */
  whyAr: string;
  /** The concrete fix. Never «retry» on its own for a money error. */
  fixAr: string;
  owner: FaultOwner;
  /** `stop` = money must not move; `warn` = recorded, sale continues. */
  level: 'stop' | 'warn';
}

const F = (code: string, ar: string, en: string, whyAr: string, fixAr: string, owner: FaultOwner, level: 'stop' | 'warn' = 'stop'): Fault =>
  ({ code, ar, en, whyAr, fixAr, owner, level });

/** The whole money path's vocabulary — checkout, gateway, direct bank, ledger and the payment guard. */
export const FAULTS: Fault[] = [
  // ── the visitor's form ──
  F('INVALID_ITEM', 'فيه منتج في السلة مش صحيح — رجّع للسلة وأضفه تاني.', 'An item in the basket is not valid.', 'الصنف أو الكمية مش مطابقة لما السيرفر بيقبله (SKU ناقص، كمية مش عدد صحيح، أو أكتر من 99).', 'السلة تتبني من كتالوج الموقع نفسه، والكمية عدد صحيح 1–99.', 'visitor'),
  F('EMPTY_ORDER', 'السلة فاضية.', 'The basket is empty.', 'الطلب وصل السيرفر من غير أي بند صالح.', 'الزائر يضيف منتج؛ والواجهة تمنع زر الدفع على سلة فاضية.', 'visitor'),
  F('EMPTY_CART', 'السلة فاضية — مفيش حاجة تتدفع.', 'The cart is empty.', 'حارس المدفوعات استلم سلة بلا بنود (نفس EMPTY_ORDER من ناحية الحارس).', 'نفس إصلاح EMPTY_ORDER: مفيش دفع على سلة فاضية.', 'visitor'),
  F('INVALID_COUNTRY', 'بلد التسليم مش صحيح — اختار بلدك من القائمة.', 'The delivery country is not valid.', 'كود البلد مش بصيغة ISO أو مش موجود في جدول العملات.', 'اختيار البلد من قائمة الموقع، والبلد هي اللي تحدد العملة والشحن.', 'visitor'),
  F('MISSING_NAME', 'اكتب اسمك بالكامل.', 'Please write your full name.', 'اسم المستلم ناقص أو فاضي بعد التنظيف.', 'الاسم مطلوب للشحن والجمارك.', 'visitor'),
  F('INVALID_EMAIL', 'الإيميل مش صحيح — إحنا بنبعت عليه تأكيد الطلب.', 'The e-mail is not valid.', 'الإيميل مش بصيغة بريد صحيحة.', 'الإيميل هو قناة التأكيد والفاتورة.', 'visitor'),
  F('INVALID_PHONE', 'رقم الموبايل ناقص — اكتبه بكود البلد.', 'The phone number is incomplete.', 'الرقم أقل من 7 أرقام بعد شيل الرموز.', 'الشركة بتكلم الرقم قبل التسليم؛ رقم ناقص = طرد مرتجع.', 'visitor'),
  F('MISSING_ADDRESS', 'اكتب المدينة والعنوان بالتفصيل.', 'Please add the city and the address.', 'المدينة فاضية أو العنوان أقل من 5 حروف.', 'العنوان الناقص هو أكبر سبب لرجوع الطرد.', 'visitor'),
  F('RATE_LIMITED', 'محاولات كتير في وقت قصير — استنى دقيقة وحاول تاني.', 'Too many attempts — wait a minute.', 'حد المعدل اتمسك (6 طلبات في الدقيقة لكل زائر).', 'الحد مقصود ضد التكرار والاحتيال؛ لو الزائر شرعي، يستنى دقيقة.', 'visitor', 'warn'),

  // ── availability and sign-in ──
  F('UNAVAILABLE', 'منتج في سلتك خلص من المخزون — شيله وكمل.', 'A product in your basket is out of stock.', 'السيرفر لقى صنف مش متاح أو سعره صفر في الكتالوج وقت الدفع.', 'الكمية تتظبط من الكتالوج الحقيقي، والمنتج يتشال من السلة تلقائياً.', 'visitor'),
  F('METHOD_UNAVAILABLE', 'وسيلة الدفع دي مش متاحة لبلدك — اختار وسيلة تانية.', 'This payment method is not available for your country.', 'الوسيلة مش من ضمن الوسائل المعتمدة للبلد/العملة.', 'الوسائل تتبني من `finance.methods(country, currency)` مش من قائمة ثابتة في الواجهة.', 'robot'),
  F('PAYMENTS_NOT_CONFIGURED', 'الدفع الأونلاين لسه مش مفعّل — استخدم الدفع المباشر (إنستاباي/تحويل/محفظة/الاستلام).', 'Online payment is not configured yet.', 'مفاتيح البوابة ناقصة أو غير صحيحة، فالسيرفر رفض فتح جلسة دفع.', '«بنك شام» المباشر شغال من غير بوابة؛ ومفاتيح كاشير تتظبط في إعدادات النشر مش في الكود.', 'merchant'),
  F('LOGIN_REQUIRED', 'سجّل دخول بحسابك قبل الدفع بالبطاقة أو المحفظة.', 'Please sign in before paying by card or wallet.', 'الدفع عبر البوابة يتطلب حساباً مؤكداً من السيرفر (قاعدة صاحب الموقع).', 'الدفع المباشر (إنستاباي/تحويل/استلام) متاح للزائر من غير حساب — البطاقة لأ.', 'visitor'),
  F('CARD_NOT_ACCEPTED', 'مش بنستقبل بيانات الكارت على صفحاتنا — الدفع بيتم على صفحة البوابة نفسها.', 'Card details are never accepted on our pages.', 'فيه محاولة إرسال رقم كارت للسيرفر، وده مرفوض بالتصميم.', 'حقول الكارت المستضافة عند البوابة فقط (hosted fields) — الكود بيرفض أي سر كارت.', 'robot'),

  // ── the payment guard (src/finance/shield.ts) ──
  F('PAYMENT_HELD', 'الدفع اتوقف للمراجعة — محدش اتخصم منه حاجة.', 'The payment was held for review — nothing was charged.', 'حارس المدفوعات لقى في السلة/العملة/الإجمالي حاجة مش منطقية، فوقف الدفع قبل أي فلوس.', 'الحارس بيسمّي البند اللي وقف (تحت) — والمراجعة بشرية قبل أي خصم.', 'robot'),
  F('INVALID_CURRENCY', 'عملة الطلب مش صحيحة.', 'The order currency is not valid.', 'كود العملة مش 3 حروف ISO.', 'العملة تتبني من بلد الزائر عبر `currencyFor`.', 'robot'),
  F('UNKNOWN_CURRENCY', 'العملة دي مش معروفة للمحرك المالي.', 'This currency is unknown to the money engine.', 'العملة مش في جدول العملات المعروف للمحرك (خانات عشرية غير معروفة).', 'أي عملة جديدة تتضاف للجدول قبل ما تظهر للزائر.', 'robot'),
  F('CHARGE_CURRENCY_NOT_COUNTRY', 'الخصم كان هيتعمل بعملة غير عملة بلدك — اتوقف.', 'Charging in a currency that is not your country’s was stopped.', 'عملة الخصم مختلفة عن عملة البلد، والفرق مش من ضمن البدائل المقبولة.', 'العملة الافتراضية = عملة البلد؛ البديل (EGP/USD) لازم يكون مقبول من البوابة ومعلن للزائر.', 'robot'),
  F('CHARGE_CURRENCY_FALLBACK', 'الخصم هيتعمل بالعملة البديلة لأن عملة بلدك مش مقبولة من البوابة.', 'The charge uses the fallback currency because your country’s currency is not accepted.', 'البوابة مش بتقبل عملة البلد، فالخصم بيتحول لـEGP/USD — الصفحة لازم تقول ده قبل الدفع.', 'الشات والدفع لازم يعرضوا عملة الخصم الحقيقية ومبلغها، مش عملة العرض بس.', 'robot', 'warn'),
  F('DISPLAY_CURRENCY_DIFFERS', 'الصفحة بتعرض عملة والخصم بعملة تانية — لازم تشوف المبلغ النهائي قبل الدفع.', 'The page shows one currency and the charge is in another.', 'عملة العرض (اختيار الزائر/اللغة) مختلفة عن عملة الخصم.', 'عرض مبلغ الخصم النهائي وعملته في خطوة تأكيد قبل الانتقال للبوابة.', 'robot', 'warn'),
  F('DUPLICATE_LINE', 'نفس المنتج مكرر في السلة — اتجمّع في بند واحد.', 'The same product appears twice.', 'السلة وصلت بندين لنفس الـSKU.', 'البنود تتجمّع في الواجهة قبل الإرسال، والحارس بيرفض التكرار.', 'robot'),
  F('INVALID_SKU', 'كود منتج في السلة غلط.', 'A product code is invalid.', 'SKU ناقص أو أطول من 80 حرف.', 'السلة من الكتالوج فقط.', 'robot'),
  F('INVALID_QTY', 'كمية غير صحيحة لمنتج.', 'A quantity is invalid.', 'الكمية مش عدد صحيح أو أكبر من 99.', 'الكمية عدد صحيح 1–99 لكل بند.', 'robot'),
  F('INVALID_AMOUNT', 'سعر غير صحيح في السلة.', 'An amount in the cart is invalid.', 'سعر بند أو إجمالي مش رقم موجب.', 'الأسعار بتتحسب على السيرفر من الكتالوج، مش على المتصفح.', 'robot'),
  F('INVALID_ITEMS', 'إجمالي البنود مش مضبوط.', 'The items total does not add up.', 'مجموع البنود مش مطابق لحقل البنود.', 'إعادة حساب البنود على السيرفر قبل الحارس.', 'robot'),
  F('INVALID_TOTAL', 'الإجمالي مش مضبوط.', 'The total does not add up.', 'الإجمالي النهائي مش رقم موجب.', 'الإجمالي = البنود + الشحن، يُحسب على السيرفر.', 'robot'),
  F('INVALID_SHIPPING', 'الشحن في الطلب غير صحيح.', 'The shipping amount is invalid.', 'الشحن سالب أو مش رقم.', 'الشحن من جدول الشحن المنشور فقط.', 'robot'),
  F('LINE_MATH', 'حساب أحد البنود مش مضبوط.', 'A line does not add up.', 'السعر × الكمية ≠ الإجمالي في بند (كسر عشري أو تلاعب).', 'الحساب في وحدات صغرى صحيحة (minor units) قبل العرض.', 'robot'),
  F('ITEMS_MATH', 'مجموع البنود مش مضبوط.', 'The items total does not add up.', 'مجموع البنود ≠ مجموع البنود المحسوبة.', 'إعادة الجمع بالوحدات الصغرى.', 'robot'),
  F('TOTAL_MATH', 'الإجمالي مش مضبوط (البنود + الشحن).', 'The total does not equal items plus shipping.', 'الإجمالي ≠ البنود + الشحن.', 'احسب الإجمالي بالوحدات الصغرى ثم اعرضه.', 'robot'),
  F('PRECISION', 'خانة عشرية زيادة في مبلغ.', 'An amount has more decimals than the currency allows.', 'مبلغ بخانات عشرية أكبر من عملته (مثلاً 3 خانات لجنيه).', 'التقريب بيتعمل مرة واحدة في المحرك المالي (`toMinor`).', 'robot'),
  F('ABSURD_PRICE', 'سعر في السلة مش منطقي — اتوقف للمراجعة.', 'A price is not plausible — held for review.', 'سعر بند أعلى من سقف منطقي (خطأ إدخال أو تلاعب).', 'راجع سعر المنتج في الكتالوج؛ لو غلط يتصلح في المصدر.', 'merchant'),
  F('BELOW_COST', 'سعر البيع أقل من التكلفة × 1.5 (قاعدة صاحب المتجر) — اتوقف.', 'The price is below cost × 1.5 (the merchant’s rule) — stopped.', 'سعر البند أقل من التكلفة × 1.5، فالهامش الصافي بينكسر.', 'قاعدة 50% صافية قرار صاحب المتجر؛ يتصلح السعر أو يتأكد الاستثناء قبل البيع.', 'merchant'),
  F('TOO_MANY_LINES', 'عدد الأصناف أكبر من الحد.', 'Too many lines in the cart.', 'عدد البنود فوق 30.', 'تقسيم الطلب أو مراجعة بشرية — الحد ضد إساءة الاستخدام.', 'robot'),
  F('TOO_MANY_BOTTLES', 'عدد الزجاجات أكبر من الحد.', 'Too many bottles.', 'إجمالي الكمية فوق سقف الطلب الواحد.', 'طلبات الجملة تتعامل بمسار منفصل، لا بسلة التجزئة.', 'robot'),
  F('TOTAL_TOO_LARGE', 'إجمالي الطلب أكبر من الحد.', 'The order total is above the limit.', 'الإجمالي فوق سقف الحارس (عملية غير عادية).', 'مراجعة بشرية قبل أي دفعة كبيرة.', 'merchant'),
  F('COMMISSION_RANGE', 'نسبة العمولة خارج النطاق المسموح.', 'The commission rate is out of range.', 'نسبة العمولة سالبة أو أكبر من 50%.', 'العمولة في حدود 0–50%، والقيمة الافتراضية من إعداد المنصة.', 'robot'),
  F('COMMISSION_INVALID', 'نسبة العمولة غير صحيحة.', 'The commission rate is invalid.', 'العمولة مش رقم.', 'نفس إصلاح COMMISSION_RANGE.', 'robot'),

  // ── the gateway ──
  F('UNREACHABLE', 'البوابة مش بتفتح دلوقتي — جرّب تاني أو ادفع مباشر.', 'The payment page could not be reached.', 'طلب الاتصال بالبوابة فشل أو انتهى وقته (شبكة/انقطاع).', 'مسار الدفع المباشر بديل جاهز؛ والمراقب بيرصد تكرار الفشل.', 'gateway'),
  F('INVALID_KEYS', 'إعدادات الدفع محتاجة مراجعة من الإدارة.', 'Payment settings need review.', 'البوابة رفضت المفاتيح (401/403) — مفتاح غلط أو وضع مختلف (test/live).', 'المفاتيح تتظبط في إعدادات النشر؛ الكود مايبدّلهاش أبداً.', 'merchant'),
  F('REJECTED', 'البوابة رفضت فتح صفحة الدفع.', 'The gateway refused to open the payment page.', 'البوابة ردّت برفض (مبلغ/عملة/بيانات ناقصة).', 'راجع رد البوابة في سجل المحاولات؛ العملة لازم تكون من عملات الحساب.', 'gateway'),
  F('INVALID_RESPONSE', 'رد البوابة مش مفهوم — مفيش خصم مؤكد.', 'The gateway returned an unexpected response.', 'رد البوابة ناقص/غريب (رابط جلسة أو مبلغ غير صالح).', 'مانعتبرش الدفع ناجح من رد غير صالح؛ نعيد القراءة من البوابة.', 'gateway'),
  F('INVALID_SESSION', 'مرجع جلسة الدفع مش صحيح.', 'The payment session reference is invalid.', 'معرّف الجلسة مش بصيغة صحيحة (محاولة تلاعب محتملة).', 'الجلسة بتتحقق بصيغتها قبل أي نداء للبوابة.', 'robot'),
  F('NOT_FOUND', 'مفيش سجل للطلب ده.', 'No such record.', 'الجلسة أو الطلب مش موجود عند البوابة أو في السجل.', 'المطابقة اليومية بتقرا السجل والبوابة وتقفل الفروق.', 'robot'),
  F('NETWORK', 'الشبكة قطعت أثناء بدء الدفع — محاولش تدفع مرتين.', 'The network dropped while starting the payment.', 'طلب الفتح من المتصفح فشل قبل رد السيرفر.', 'الشات يقول للزائر: متكررش الدفع، والسجل بيتطابق من البوابة.', 'visitor'),
  F('FAILED', 'الدفع مكتملش.', 'The payment did not complete.', 'الدفع انتهى بحالة غير مدفوعة (رفض/إلغاء/انتهاء وقت).', 'الزائر يجرّب وسيلة تانية؛ والسجل بيرصد الحالة الحقيقية من البوابة.', 'visitor', 'warn'),
  F('INVALID_PAYMENT_URL', 'رابط الدفع غير آمن — اتوقف.', 'The payment URL was not safe — stopped.', 'رابط البوابة مش من نطاق كاشير أو فيه بورت/مستخدم.', 'الواجهة بتتحقق من النطاق قبل التحويل؛ أي رابط غريب بيتمنع.', 'robot'),
  F('HOSTED_FIELD_REQUIRED', 'بيانات الكارت بتتكتب على صفحة البوابة بس.', 'Card details must be entered on the gateway’s page.', 'محاولة إرسال بيانات كارت لصفحتنا — مرفوضة بالتصميم.', 'استخدام الحقول المستضافة؛ إحنا مانلمسش سر الكارت.', 'robot'),

  // ── the ledger (the money record) ──
  F('PAYMENT_MISMATCH', 'الدفع اتوقف: المبلغ/العملة مش مطابقين للطلب.', 'The payment does not match the order.', 'اللي رجع من البوابة (مبلغ أو عملة أو جلسة) مش مطابق للسجل.', 'السجل والبوابة يتطابقوا قبل أي تسليم؛ الفرق يتقفل بمذكرة.', 'robot'),
  F('UNTRACKED_PAYMENT', 'فيه تحصيل بلا طلب مسجل — محتاج مطابقة.', 'A payment arrived with no matching order.', 'فلوس وصلت لمرجع مش موجود في السجل المالي.', 'مطابقة مع كشف البوابة؛ مفيش تسليم ولا إيراد بلا سجل.', 'merchant'),
  F('SESSION_CONFLICT', 'جلسة دفع تانية لنفس الطلب اترفضت.', 'A second payment session for the same order was refused.', 'محاولة استبدال جلسة دفع موجودة بجلسة جديدة.', 'طلب واحد = جلسة واحدة؛ إعادة الفتح بمحاولة جديدة مقصودة فقط.', 'robot'),
  F('DUPLICATE_ORDER', 'الطلب مسجل بالفعل.', 'The order already exists.', 'نفس المرجع اتسجل مرتين (تكرار شبكة/إعادة إرسال).', 'المرجع فريد — التكرار بيرجع الطلب الأصلي بدل إنشاء جديد.', 'robot'),
  F('INVALID_ORDER_TOTAL', 'إجمالي الطلب لا يطابق بنوده.', 'The order total does not equal its lines.', 'الإجمالي المسجل ≠ (البنود + الشحن) في الوحدات الصغرى.', 'الحساب في `toMinor` و`sumMinor` فقط — أبداً في أرقام عشرية.', 'robot'),
  F('FINANCE_STORAGE_REQUIRED', 'الدفع الحي متوقف لحد ما السجل المالي الدائم يتفعّل.', 'Live payment is paused until the ledger is durable.', 'قاعدة: مفيش دفع حقيقي بلا سجل دائم (مفيش فلوس بلا ذاكرة).', 'توصيل السجل بقاعدة بيانات دائمة قبل تشغيل الوضع الحي.', 'merchant'),
  F('INVALID_IDEMPOTENCY_KEY', 'مفتاح منع التكرار ناقص.', 'The idempotency key is missing.', 'قيد مالي بلا مفتاح ثابت يمنع تسجيله مرتين.', 'كل قيد مالي لازم مفتاح 16–80 حرفاً.', 'robot'),
  F('IDEMPOTENCY_CONFLICT', 'نفس المفتاح بمحتوى مختلف.', 'The same key was reused with different content.', 'مفتاح منع التكرار استُخدم لقيد بمبلغ/عملة مختلفة.', 'المفتاح يوصف العملية مرة واحدة فقط.', 'robot'),
  F('INVALID_ENTRY_KIND', 'نوع القيد غير مسموح يدوياً.', 'This entry kind cannot be added manually.', 'محاولة تسجيل «تحصيل» يدوي أو تغيير حالة دفع من الواجهة.', 'التحصيل بيتسجل من البوابة، مش يدوياً.', 'robot'),
  F('INVALID_AMOUNT_ENTRY', 'مبلغ القيد غير صحيح.', 'The entry amount is invalid.', 'قيد بمبلغ صفر/سالب أو بخانات عشرية زيادة.', 'المبالغ في الوحدات الصغرى وبعملة الطلب.', 'robot'),
  F('INVALID_REASON', 'سبب القيد مطلوب.', 'A reason is required for this entry.', 'قيد (استرداد/تسوية) بلا سبب مكتوب.', 'كل استرداد لازم سبب ومرجع الطلب.', 'robot'),
  F('INVALID_DATE', 'تاريخ القيد غير صحيح.', 'The entry date is invalid.', 'تاريخ غير قابل للقراءة أو في المستقبل البعيد.', 'التاريخ من مصدر موثّق (كشف البوابة).', 'robot'),
  F('UNKNOWN_ACCOUNT', 'رقم الحساب مش معروف — تأكّدي من رقم الحساب قبل التحويل.', 'The account number is unknown.', 'رقم الحساب اللي اتكتب مش موجود في السجل المالي.', 'تأكّدي من رقم الحساب قبل إرسال التحويل.', 'visitor'),
  F('INVALID_EXPENSE', 'نوع المصروف غير مسموح.', 'This expense kind is not allowed.', 'مصروف غير معترف به في السجل المالي.', 'اختر مصروفا من القائمة المعتمدة: شحن، رسوم، ضريبة، تكلفة، أخرى.', 'robot'),
  F('STALE_REPORT', 'تقرير روبوت قديم جدا - مفيش رقم طازج.', 'A robot report is stale - no fresh number.', 'تقرير روبوت أكبر منضعف فترة تشغيله المتوقعة (مفيش تحديث يومي).', 'شغل الروبوت مرة أخرى وحدث مصدر تحديثه، أو اعتمد التقرير القديم.', 'robot', 'warn'),

  F('INVALID_REVERSAL', 'العكس المطلوب غير صحيح.', 'The reversal requested is invalid.', 'محاولة عكس قيد مش موجود أو معكوس بالفعل.', 'العكس لقيد واحد فقط، ومرة واحدة.', 'robot'),
  F('REFUND_REVIEW', 'الاسترداد محتاج قيد محاسبي قبل ما يتأكد.', 'The refund needs a bookkeeping entry first.', 'البوابة أبلغت عن استرداد/اعتراض، وتغيير حالة الطلب لوحدها مش إثبات رد المال.', 'راجع كشف البوابة وسجل الاسترداد الفعلي، وسجّل القيد مع مرجعه.', 'merchant'),
  F('OVER_REFUND', 'الاستردادات أكبر من التحصيل — محتاج مراجعة.', 'Refunds exceed the amount collected.', 'مجموع الاستردادات/الاعتراضات لطلب أكبر من مبلغ البيع.', 'طابق كشف البوابة واعكس القيد المكرر مع سبب؛ مايتعادش إرسال مبلغ تلقائياً.', 'merchant'),
  F('MISSING_COSTS', 'فيه تكاليف ناقصة فصافي الربح مش محسوب.', 'Some costs are missing, so net profit cannot be computed.', 'بيع مسجل من غير تكلفة/شحن/رسوم/ضريبة.', 'سجّل التكلفة الفعلية لكل طلب (وصفراً مؤكداً لو البند مش منطبق).', 'merchant', 'warn'),
  F('GATEWAY_FAILURES', 'نسبة فشل عالية في البوابة النهاردة.', 'A high gateway failure rate today.', '20%+ من محاولات الدفع فشلت على عينة كافية.', 'راجع الاتصال والمفاتيح والوضع؛ مايتغيرش مزوّد الدفع تلقائياً.', 'gateway', 'warn'),
  F('GATEWAY_SLOW', 'البوابة بطيئة.', 'The gateway is slow.', 'زمن استجابة البوابة p95 أكبر من 8 ثوانٍ.', 'قياس دوري + بديل الدفع المباشر للزوار.', 'gateway', 'warn'),
  F('STALE_PENDING', 'فيه جلسات دفع معلقة أكتر من يوم.', 'Some payment sessions have been pending over a day.', 'جلسة حية من غير بيع مسجل بعد 24 ساعة.', 'المطابقة تقرا حالة الجلسة من البوابة؛ مفيش تخمين مدفوع/ملغي.', 'robot', 'warn'),
  F('TEST_MODE', 'الدفع في وضع تجريبي — مش تحصيل حقيقي.', 'Payments are in test mode — not real money.', 'مفاتيح الوضع التجريبي شغالة.', 'الوضع الحي يتفعّل بقرار صاحب المتجر بعد اعتماد الحساب.', 'merchant', 'warn'),
  F('PAID_ORDER_REQUIRED', 'العملية دي محتاجة طلب مدفوع.', 'This operation needs a paid order.', 'محاولة استرداد أو تسوية على طلب لسه مش مدفوع.', 'الاسترداد بعد التحصيل وبس.', 'robot'),
  F('AMOUNT_EXCEEDS_PAYMENT', 'المبلغ أكبر من المتحصل.', 'The amount is above what was collected.', 'استرداد أكبر من مبلغ البيع المسجل.', 'نفس إصلاح OVER_REFUND.', 'merchant'),
  F('ORDER_SYNC_FAILED', 'الطلب اتسجل ماليًا بس مابوصلش لنظام التجار.', 'The order is recorded financially but did not reach the merchant system.', 'إرسال الطلب للتجار فشل بعد فتح صفحة الدفع.', 'السجل المالي محفوظ؛ الطلب يتطابق يدوياً قبل التسليم.', 'robot', 'warn'),
  F('PAID_SYNC_FAILED', 'التحصيل محفوظ والتسليم محتاج متابعة.', 'The payment is recorded but fulfilment needs follow-up.', 'التأكيد وصل بس التنفيذ (تجار/شحن) فشل.', 'طابق الطلب المحصل؛ مايتعادش الخصم.', 'robot', 'warn'),
  F('FINANCE_UNAVAILABLE', 'الخدمة المالية مش متاحة دلوقتي — جرّب بعد شوية.', 'The finance service is unavailable.', 'خطأ داخلي في السجل المالي (قاعدة البيانات أو الخدمة).', 'الطلب مايتأكدش من غير السجل؛ يعيد المحاولة بنفس المرجع.', 'robot', 'warn'),

  // ── the price the visitor saw (the gap this round closes) ──
  F('PRICE_CHANGED', 'السعر اتغير من وقت ما فتحت السلة — راجع المبلغ الجديد قبل الدفع.', 'The price changed since you opened the basket — check the new total before paying.', 'الإجمالي اللي الواجهة عرضته مش مطابق للإجمالي اللي السيرفر بيحصّله (تحديث سعر/شحن/عملة بين الصفحة والدفع).', 'الواجهة بتعرض الفرق والمبلغ الجديد وتطلب موافقة صريحة — مفيش خصم بمبلغ غير اللي الزائر شافه.', 'robot'),
];

const BY_CODE = new Map(FAULTS.map((f) => [f.code, f]));

/** The visitor-facing sentence and the owner-facing explanation for a code — never a bare code. */
export function explainFault(code: string, lang: 'ar' | 'en' = 'ar'): Fault {
  const found = BY_CODE.get(String(code || '').toUpperCase());
  if (found) return found;
  return {
    code: String(code || 'UNKNOWN'),
    ar: 'حصلت مشكلة في الدفع مش موثّقة — محدش اتخصم منه حاجة، وفريق المتجر هيراجعها.',
    en: 'An undocumented payment problem happened — nothing was charged, and the store will review it.',
    whyAr: `الكود «${code}» مش موجود في قاموس أخطاء الدفع — يعني رسالة جديدة اتنشرت من غير تفسير.`,
    fixAr: 'أضف الكود لتفسيره في src/finance/errors.ts؛ الاختبار بيمنع أي كود من غير تفسير.',
    owner: 'robot',
    level: 'warn',
  };
}

export const faultCodes = (): string[] => FAULTS.map((f) => f.code);
export const isKnownFault = (code: string): boolean => BY_CODE.has(String(code || '').toUpperCase());
