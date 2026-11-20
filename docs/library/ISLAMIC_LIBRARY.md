# مكتبة شام الإسلامية · Sham Islamic Library

من الرئيسية ← **مكتبة شام الإسلامية**، أو من قائمة **استكشف**. مسار التطبيق `#islamic_library` (بعد `/Sham-Perfume/` على Pages). هناك أيضًا صفحة تعريف قابلة للفهرسة في `tools/islamic-library.html` تحيل إلى الأرفف.

## التصوّر والتنفيذ

واجهة عربية من اليمين لليسار مع بديل إنجليزي. رسم تخيّلي لقاعة بأقواس وفانوس وضوء مشربية، ثم رفوف خشبية وأغلفة مرسومة بالـ CSS. الأغلفة توضيحية، وليست صور طبعات الناشرين. يمكن تصفية الأرفف والبحث باسم الكتاب أو مؤلفه بدون اشتراط التشكيل. لا تُحمّل القاعة أو حزمة الواجهة على الرئيسية، ولا يُطلب نص المصحف قبل فتح القارئ.

- **١١ رفًا، ٥٥ عنوانًا**: القرآن وعلومه، التفسير، الحديث والسنة، علوم الحديث، السيرة والشمائل، الفقه والمذاهب، أصول الفقه، العقيدة، الأذكار والآداب، التاريخ والتراجم، واللغة والمعاجم. هذا اختيار تحريري، لا حصر للمؤلفات الإسلامية.
- **قراءة هنا**: المصحف كاملًا (١١٤ سورة و٦٢٣٦ آية)، بفهرس السور والآيات، والتصفح بمقاطع من ١٦ آية كحد أقصى (لا تحاكي حدود صفحات المصحف الورقي). يمكن تكبير الخط ووضع علامة على الآية لاستئناف القراءة. يُحفظ رقم السورة والآية فقط في `localStorage` على الجهاز؛ لا حساب أو مزامنة أو إرسال للعلامة إلى خادم. مثال رابط مباشر: `#islamic_library?book=mushaf&surah=2&ayah=255`.
- **عند المصدر**: بطاقة المؤلف والطبعة، حيث تتوافر بياناتها، وزر يفتح النص لدى المكتبة الشاملة أو Sunnah.com أو IslamHouse في تبويب جديد. لا نسخ للنصوص أو ملفات الطبعات منهم ولا تضمين لصفحاتهم. صحيح البخاري ومسلم والسنن لها روابط مجموعات الحديث؛ مسند أحمد يشير إلى فهرس نسخة مؤسسة الرسالة في الشاملة بدل نسخة Sunnah.com الجزئية.
- **فهارس أوسع**: أقسام الشاملة مرتبطة من كل رف، وتوجد روابط لفهارس الشاملة والوقفية ومجموعات الحديث. لا تُضاف محتوياتها إلى العدد المحلي. يمكن أن تغيّر المواقع الخارجية عناوينها أو الإتاحة.

الأرفف والكتب في `src/library/islamic/catalog.ts`. لإضافة عنوان، راجع صفحة الكتاب نفسها (لا نتيجة تحيل إلى اقتباس منه)، وأضف معرّفًا ثابتًا، العنوان، المؤلف، وصفًا قصيرًا عربيًا/إنجليزيًا، والطبعة ورابط قراءة مباشر HTTPS. راجع الروابط قبل النشر. لا تضف ملفات طبعات حديثة ما لم تتوافر الإتاحة والترخيص المناسبان. البحث والعدّ يتولدان من البيانات نفسها. القارئ ونافذة البطاقة يستخدمان `dialog` لاحتواء التركيز، وإغلاق Esc وزر الرجوع، واستعادة التركيز على الغلاف. القراءة وفتح الطبعة لا يحتاجان خدمة خلفية.

## Text provenance and attribution

- `public/books/tanzil-uthmani-1.1.txt`: **Tanzil Quran Text (Uthmani, Version 1.1), Copyright (C) 2007–2026 Tanzil Project**, [CC BY 3.0 and Tanzil verbatim terms](https://tanzil.net/docs/text_license). The page credits and links [Tanzil](https://tanzil.net/). The upstream notice remains byte-for-byte in the TXT file. The source uses indexed rows, preserves pause, rub-el-hizb and sajda markers, and puts the opening basmala in the first line of the surah where applicable. The reader splits only the row delimiters; it neither re-normalizes verse strings nor synthesizes or duplicates a basmala. Verse number controls are outside those strings.
- The exact indexed file is from the [pinned Tanzil mirror](https://github.com/AhmedWalid4499/Azkar/blob/598ca85639827d2f20aac6f36d9982128de1eace/apple/AzkarKit/Sources/AzkarContent/Resources/quran-uthmani.txt) (Git blob `15968180ffffa45f0556fa6c81fa8c99a2a70bc8`, SHA-256 `4b91f9e6e8ac645d039e4ed85b3be492e795232a31cd22d668ac58238722e26f`). As a cross-check, the 6,236 verse strings have the same word sequence as the independently mirrored plain Uthmani v1.1 file (`iptvchecker/content-tanzil`, blob `6ea429ecfe7fc75a5d6717f1b092bb2895617a3a`) when comparing with optional markers/whitespace excluded. That comparison is not a transformation of the shipped asset, nor a claim that mirrors are byte-identical to the official current download. See the [Tanzil download options](https://tanzil.net/download/) for edition/format updates. Verify any future update against upstream before changing the checksum and coverage tests.
- `quranSurahs.ts`: surah numbers, names/transliteration and counts from the [Tanzil metadata](https://tanzil.net/docs/quran_metadata), version 1.0 © 2008–2009 Tanzil.info, CC BY, [pinned metadata mirror](https://github.com/AhmedWalid4499/Azkar/blob/598ca85639827d2f20aac6f36d9982128de1eace/apple/AzkarKit/Sources/AzkarContent/Resources/quran-data.xml) (blob `ef53c5df61d52b565e5a952316209971e67bb191`). Counts and numbering are checked against every row of the indexed asset. The client requests it with subresource integrity and does not display an incomplete file.
- **Amiri Quran** Arabic WOFF2 from `@fontsource/amiri-quran@5.3.0`, © 2010–2022 The Amiri Project Authors, SIL OFL 1.1 (`public/books/licenses/amiri-quran-OFL.txt`). The hall is a generated illustration, optimized as two local WebP sizes; the share card is a crop of the same illustration.

## Verification

```sh
npm run lint
npm test
npm run build:pages
npm run check:pages
npm run preview -- --mode pages --port 4173 --strictPort
# In a second terminal, with Chromium installed:
LIBRARY_BASE_URL=http://localhost:4173/Sham-Perfume/ \
BROWSER_EXECUTABLE=/path/to/chromium \
LIBRARY_SCREENSHOTS=build/islamic-library-review \
node scripts/check-islamic-library.mjs
```

The browser check exercises widescreen Arabic and narrow Arabic/English, website and book history, search/filters, a mocked end-to-end publisher tab (the real URL is checked), fetching the same-origin Quran asset at the Pages prefix, a bookmarked verse after reload, and recovery after a failed text request. Keep screenshots untracked in `build/`.
