# لغات — باب اللغات في منصة شام

هذا الفولدر هو **المصدر الوحيد** لكل نصوص المنصة بلغاتها. أي شاشة أو قاعدة معرفة أو أداة
شاهين تقرأ من هنا، ومفيش أي نص لغوي مكتوب بره الفولدر ده.

> الاسم بالعربي زي ما اتطلب، والمجلد جوه `src/` عشان الـ imports والـ tsconfig والبناء
> (Vite / Pages / Vercel / EdgeOne) يشتغلوا عادي — كل الملفات اتنقلت بـ `git mv` فالـ history محفوظ.

## إزاي شاهين يقرأ اللغات

```ts
import { SUPPORTED_LANGUAGES, t, loc, uiLabel, contentLabel, noteMetric } from '../لغات';

t('nav_calc', 'de');              // نص الواجهة
loc('fr', { ar: '…', en: '…' });   // أي زوج عربي/إنجليزي
uiLabel('currency_egp', 'tr');     // العملة والوحدات والأزرار
contentLabel('news_ifra', 'ja');   // وسوم المحتوى (الأخبار/الخامات/الموضع)
noteMetric('evap_top', 'zh');      // مقاييس الهرم العطري
```

وتقرير جاهز للرد على المستخدم أو للوحة الإدارة:

```ts
import { languageCatalogue, languageReport, languagesSummary, isLanguageSupported } from '../لغات';

languagesSummary();      // «منصة شام بتدعم 100 لغة، منها 100 لغة بتغطية كاملة للوسوم (100/100).»
languageReport('ar');    // سطر كامل عن اللغة: الاتجاه + العدّادات
languageCatalogue();     // مصفوفة مفصّلة لكل لغة (كوفرج كل حزمة)
isLanguageSupported('de');
```

## الملفات هنا (92 ملف)

| العيلة | الملفات | إيه اللي جواها |
|---|---|---|
| `i18n.ts` + `i18nExt1…31.ts` + `i18nProfile.ts` | 33 | نصوص الواجهة الأساسية لكل اللغات + `t()` وردود الفشل، وحزمة البروفايل |
| `hubL10n*.ts` | 49 | بطاقات مركز الأدوات (13 بوابة) و52 بطاقة أخبار |
| `contentLabels.ts` + `contentLabelsExt.ts` | 2 | 15 وسم محتوى (أخبار/خامات/موضع) لكل الـ100 لغة |
| `localizedContent.ts` | 1 | مكتبة العطور، الخامات، الأخبار + `getCommonLabel` + `isRTL` |
| `commonLabelsExt.ts` | 1 | وسوم الواجهة المشتركة للغات الإضافية |
| `localize.ts` | 1 | الأداة الأساسية: `LText`، `loc`، `makeT`، `pickArEn`، `fmt`، `localeDate`، `LOCALE_MAP` |
| `noteL10n.ts` | 1 | مقاييس الهرم العطري (تطاير/انتشار/عائلة/الدرجة) |
| `numerals.ts` | 1 | **أرقام لغة الصفحة**: `formatLocalizedNumber` / `formatInputNumber` / `parseLocalizedNumber` — تنسيق وقراءة الأرقام بنظام أرقام لغة الموقع (لاتيني لكل اللغات ما عدا العربية وأخواتها بختهم الخاص)، وقراءة أي أرقام يكتبها الزائر |
| `uiTextL10n.ts` | 1 | العملة والوحدات والعدّادات وأزرار المتجر وعناوين المحاكي |
| `index.ts` | 1 | **البوابة**: إعادة تصدير كل حزم اللغات + `languageCatalogue()` |
| `README.md` | 1 | الملف ده |

## قواعد ثابتة (متختبرة في CI)

1. `t()` و`loc()` و`contentLabel()` و`uiLabel()` و`noteMetric()` كلهم بيرجعوا **إنجليزي كحد أدنى**؛
   **مفيش لغة غير عربية تشوف نص عربي أبداً** (الفارسية/الأردية/الباشتو/السندية مستثناة لأنها بتكتب
   بالحرف العربي أصلاً).
2. عدد اللغات بيتقرأ ديناميكياً من `SUPPORTED_LANGUAGES.length` — متكتبش «100» كنص ثابت في الشاشات.
3. الحزم بتتوسّع **بالموجات**: ملفات جديدة (`i18nExt32`، `hubL10nExt48`، `CONTENT_LABELS_EXT_6`…)
   بتضاف من غير ما تعدّل لغة موجودة.
4. الشاشات ممنوع يبقى فيها نص عربي مكتوب جوه JSX — فيه اختبارات حارسة على ده.

## نصوص المتجر (متجر شام + صفحة العطر + السلة)

| الملف | فيه إيه |
|---|---|
| `storeKeys.ts` | مفاتيح المتجر (`StoreTextKey`) + `STORE_BASE_LANGS` + `STORE_CORE_KEYS` (42 مفتاح أساسي) |
| `storeL10nBase.ts` | العشر لغات الأساسية لكل مفتاح، مصفوفات متراصة على ترتيب `STORE_BASE_LANGS` |
| `storeL10nExt1…9.ts` | تسع موجات × 10 لغات = التسعين لغة الباقية، مصفوفات متراصة على `STORE_CORE_KEYS` |
| `storeL10nExt.ts` | تجميع الموجات في `STORE_TEXT_WAVES` |
| `storeL10n.ts` | الحلّال: `storeText` / `makeStoreT` / `storeLabel` / `storeLocalized` / `storeNumber` / `storeReasonText` |

قاعدة الحل واحدة في كل المتجر: **لغة الزائر ← إنجليزي ← عربي ← المفتاح**، يعني اللغة اللي
مفيهاش ترجمة بتشوف إنجليزي — مستحيل تشوف عربي إلا لو اختارت عربي. الجداول والنوتات بتترجم
بـ `storeFamilyLabel`/`storeGenderLabel`/`storeSeasonLabel`/`storeOccasionLabel`، وأسباب
«اسأل شاهين» بتتبعت كـ `{ key, vars }` وتتحل في `storeReasonText` (وبتحوّل `{value}`
لوسم مترجم كمان). صفحات المنتج المستقلة (`docs/p/*.html`) بتشيل جدول الوسوم نفسه بحزمة
متراصة + سكربت صغير بيبدّل اللغة من `localStorage` (مفتاح `sham_perfume_user_language`).

## بنر المنتجات (TopPromoHub)

| الملف | فيه إيه |
|---|---|
| `bannerKeys.ts` | مفاتيح البنر الـ21 (`BannerTextKey`) + نوع الصف المتراص (`BannerRow`) |
| `bannerL10nData1…5.ts` | خمس مجموعات × 20 لغة — **كل لغة من المئة شايلة الـ21 سلسلة كلها** |
| `bannerL10n.ts` | الحلّال: `bannerText` / `makeBannerT` (لغة الزائر ← إنجليزي ← عربي ← المفتاح) |

## لغة بلد الدخول

المنصة بتفتح بلغة البلد اللي الزائر داخل منها: `getInitialLanguage()` (في `i18n.ts`) بيرجّع —
بالترتيب — اللغة اللي الزائر اختارها بنفسه (`USER_LANGUAGE_MANUAL_OVERRIDE_KEY` + المحفوظة)،
وبعدين لغة بلد الدخول من `detectEntryLanguage()` في `src/utils/geoDetector.ts`
(منطقة زمنية ← منطقة لغة المتصفح ← لغات المتصفح، من غير ما يقرأ بلد محفوظة من زيارة قديمة)،
وبعدين المحفوظة، وبعدين عربي. وبعد الفتح بييجي تحسين بالـIP (`detectEntryLanguageAsync`)
بيحترم الاختيار اليدوي. أي اختيار يدوي — من زرار اللغات أو من `LanguageContext.setLanguage` —
بيتعلّم كاختيار يدوي فمستحيل الكشف التلقائي يدوس عليه.

## اختبارات مرتبطة

| الملف | بيحمي إيه |
|---|---|
| `tests/contentLabels.test.ts` | الـ15 وسم لكل العشرات المية، والتغطية بس بتزيد |
| `tests/contentL10n.test.ts` | مفيش عربي بيوصل لأي لغة تانية (عطور/خامات/أخبار) |
| `tests/noteL10n.test.ts` | مقاييس الهرم بتترجم صح والإنجليزي بديل آمن |
| `tests/uiTextL10n.test.ts` | الوحدات والعدّادات + حارس على الشاشات المنضّفة |
| `tests/integrity.test.ts` | سلامة البنية العامة من ضمنها ملفات اللغات |
| `tests/storeL10n.test.ts` | المتجر بالـ100 لغة: مفيش عربي لغير العربي، الجداول والأسباب والسلة والصور المستقلة |
| `tests/bannerL10n.test.ts` | بنر المنتجات بالـ100 لغة + لغة بلد الدخول وثبات الاختيار اليدوي |

## إضافة لغة جديدة (وصفة سريعة)

1. ضيف اللغة في `src/types/i18n.ts` (`SUPPORTED_LANGUAGES`) و`LOCALE_MAP` في `localize.ts`.
2. اعمل ملف حزمة جديد (`i18nExtN.ts` / `hubL10nExtN.ts`) وضيفه لمصفوفة الـ exts.
3. للوسوم: ضيف كتلة في `contentLabelsExt.ts` (`CONTENT_LABELS_EXT_N`) وضيفها لـ `CONTENT_LABELS_EXTS`.
4. شغّل: `bun run lint && bun run test && bun run build:pages && bun run check:pages`.
