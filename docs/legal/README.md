# المركز القانوني — Legal Center

> **الخبير القانوني الذكي للمنصة** — يراجع كل مشتملات المنصة ويطابقها ضد قوانين 18 دولة + الأطر الدولية، ويعرض المشاكل لشاهين مع الحلول.

## الملفات

| الملف | الغرض |
|---|---|
| [`التقرير-القانوني-الشامل-شام-بيرفيوم-2026.md`](./التقرير-القانوني-الشامل-شام-بيرفيوم-2026.md) | **التقرير الرئيسي إلى شاهين** — 37 مشكلة مصنفة + خرائط قوانين + خطة 30-60-90 يوم |
| [`../../src/legal/legalExpert.ts`](../../src/legal/legalExpert.ts) | محرك الخبير القانوني — 37 اكتشاف مبرمج + `auditPlatform()` + `generateShaheenReport()` |
| [`../../src/legal/jurisdictions.ts`](../../src/legal/jurisdictions.ts) | سجل القوانين لكل دولة (EG, SA, AE, EU, US, INTL...) |
| [`../../src/legal/complianceMatrix.ts`](../../src/legal/complianceMatrix.ts) | مصفوفة ربط كل مكون بالخطر القانوني |
| [`../../src/components/LegalCenter.tsx`](../../src/components/LegalCenter.tsx) | واجهة المركز القانوني للمستخدمين (8 تبويبات: شروط، خصوصية، إرجاع، شحن، كوكيز، AI...) |

## الاستخدام السريع

```ts
import { auditPlatform, generateShaheenReport, complianceStats } from '../legal/legalExpert';

const result = auditPlatform();
console.log(generateShaheenReport(result));
// نقاط الامتثال: 42/100 — 37 مشكلة (7 حرجة، 13 عالية)

const stats = complianceStats();
// { score: 42, critical: 7, high: 13, ... }
```

```ts
import { JURISDICTIONS, requirementsForCountry } from '../legal/jurisdictions';

requirementsForCountry('SA'); // كل متطلبات السعودية
requirementsForCountry('EU'); // GDPR + DSA + AI Act + REACH...
```

```tsx
import { LegalCenter } from '../components/LegalCenter';

<LegalCenter currentLang="ar" onClose={() => setShowLegal(false)} initialTab="privacy" />
```

## كيف يعمل الخبير القانوني؟

1. **يفحص تلقائيًا:** كل مكون (Auth, Shop, Shipping, AI, Community) مربوط بمشاكل L-01..L-37 عبر `complianceMatrix.ts`.
2. **يطابق القوانين:** كل مشكلة مرتبطة بمراجع قانونية دقيقة (GDPR Art.32، مصر 151/2020، SA PDPL...) عبر `jurisdictions.ts`.
3. **يولد تقرير شاهين:** `generateShaheenReport()` يخرج ملخصًا تنفيذيًا بالعربية مع أولويات الإصلاح.
4. **يقترح نصوصًا:** كل `LegalFinding` يحتوي `solutionAr` جاهز للنسخ إلى الكود.

## التكامل مع المنصة

- **Footer:** أضف روابط إلى `LegalCenter` (الشروط، الخصوصية، الإرجاع، الشحن، الكوكيز، AI).
- **AuthModal:** اربط checkbox بالـ Terms الفعلي + اجعل افتراضي false.
- **Checkout:** اعرض تفصيل VAT/جمارك + تحذير UN1266 قبل الدفع.
- **كل حاسبة:** أضف إخلاء IFRA/CLP فوقها.
- **كل رد شاهين:** أضف وسم "مولد بالذكاء الاصطناعي".
- **Admin:** اعرض `complianceStats()` في لوحة الإدارة كـ KPIs.

## التنبيه القانوني

> هذه أدوات معلوماتية، لا تغني عن استشارة محامٍ مرخص في مصر/السعودية/الإمارات قبل نشر أي صفحة قانونية. راجع `التقرير-القانوني-الشامل` للتفاصيل الكاملة.
