# Data Processing Agreement (DPA) — L-15 Fix
## اتفاقية معالجة البيانات — المنصة ↔ المعالجون

**Status:** مسودة جاهزة للتوقيع — إلى شاهين

This document satisfies GDPR Art.28 + SA PDPL Art.20 for processors: Vercel (hosting), Firebase/Firestore (DB), EdgeOne (CDN), Paymob/Stripe (payments).

### 1. الأطراف
- **Controller:** Sham Perfume Platform (ممثل: s.p.culculat@gmail.com (موضوع الرسالة «[شام | الخصوصية]»), DPO: s.p.culculat@gmail.com (موضوع الرسالة «[شام | حماية البيانات]»))
- **Processors:** Vercel Inc. (USA), Google LLC Firebase (USA/EU), Tencent Cloud EdgeOne (APAC), Paymob (EG), Stripe (US/EU)

### 2. موضوع المعالجة
- حسابات، طلبات/شحن، وصفات عطرية، محادثات شاهين (اختياري)، سجلات أمن
- لا نعالج بيانات صحية حساسة بدون موافقة صريحة منفصلة

### 3. التزامات المعالج
- يعالج فقط بتعليمات موثقة من المنصة
- سرية: موظفون ملتزمون بسرية، تشفير AES-256 + TLS 1.3
- أمن: Art.32 تدابير (تشفير، اختبار اختراق سنوي، نسخ احتياطي مشفر)
- معالجات فرعية: بإشعار 30 يوم + حق اعتراض
- مساعدة: في طلبات حقوق الأفراد + DPIA + إخطار خرق 24h
- حذف/إرجاع: عند انتهاء الخدمة، مسح/إرجاع كل بيانات خلال 30 يوم

### 4. النقل الدولي
- إلى أمريكا/آسيا: Standard Contractual Clauses (SCCs) + Transfer Impact Assessment
- SA PDPL: نقل بموافقة مسبقة + ضمانات كافية (م.20)
- المستخدمون يُبلّغون في Privacy Policy: "نستخدم Vercel (أمريكا) مع SCCs"

### 5. التدقيق
للمتَحكّم حق تدقيق سنوي (استبيان أو تقرير SOC 2).

### 6. المدة
سارٍ طالما الخدمة نشطة + 30 يوم بعد الانتهاء للمسح.

---
**إجراءات مطلوبة من شاهين:**
1. وقّع DPA الإلكتروني مع Vercel: https://vercel.com/legal/dpa
2. وقّع Firebase DPA: Google Cloud DPA (covers Firestore)
3. أضف بند Privacy Policy الحالي — تم ✅ (LegalCenter → Privacy → "مع من نشارك")
4. احفظ نسخ PDF في `docs/legal/processor-dpas/`

**التكلفة:** مجاني (نماذج قياسية).
**المرجع:** L-15 in `التقرير-القانوني-الشامل`
