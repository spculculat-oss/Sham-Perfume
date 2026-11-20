# تشغيل روبوتات شام على Hugging Face — من غير فيزا (خطوات صاحب الموقع)

الروبوتات كلها (32 روبوت على مواعيدهم) بتشتغل على **Space مجاني على Hugging Face**:
- مش محتاج أي كارت.
- السيرفر فيه 2 معالج و16 جيجا رام.
- الحساب: `sham3331`، واسم الـ Space: `sham-robots`.
- العنوان بعد التشغيل: https://sham3331-sham-robots.hf.space

الكود هو نفس كود Render بالظبط (`scripts/robots/`). الفرق الوحيد إن ملف التشغيل هنا هو
`scripts/robots/huggingface/Dockerfile`، وده بيشغّل `scripts/robots/space-setup.sh`.

## ١) مفتاح GitHub للروبوتات (لو لسه ماعملتهوش)

نفس الخطوة ١ في `docs/RENDER_ROBOTS.md`، وهي على اللينك ده: https://github.com/settings/personal-access-tokens/new
- الاسم: `sham-robots`.
- المستودع: `Sham-Perfume` بس.
- **Contents** و **Issues** و **Pull requests**: `Read and write` (قراءة وكتابة).
- **Actions**: `Read-only` (قراءة بس).

## ٢) اعمل الـ Space

1. افتح: https://huggingface.co/new-space
2. **Space name** (الاسم): `sham-robots`
3. **Select the Space SDK** (نوع التشغيل): **Docker**، وبعدين اختار **Blank** (فاضي).
4. **Space hardware** (السيرفر): **CPU basic · 2 vCPU · 16 GB · FREE** (المجاني).
5. **Visibility** (الظهور): **Public** (عام). خريطة التشغيل في لوحة التحكم محتاجة تقرأ حالة الروبوتات، والصفحة مفيهاش أي سر: أسامي الروبوتات ومواعيدها بس.
6. دوس **Create Space** (اعمل الـ Space).

## ٣) حط المفاتيح كأسرار

1. افتح: https://huggingface.co/spaces/sham3331/sham-robots/settings
2. انزل لحد **Variables and secrets** (المتغيرات والأسرار).
3. دوس **New secret** (سر جديد). اعمل ده 3 مرات، مرة لكل سر من دول:
   - `ROBOTS_GITHUB_TOKEN`: المفتاح اللي عملته في الخطوة ١.
   - `GEMINI_API_KEY`: من https://aistudio.google.com/apikey
   - `SHAM_ADMIN_TOKEN`: نفس القيمة اللي في Vercel.
4. أي مفتاح تاني عندك في أسرار GitHub تقدر تضيفه بنفس الاسم. اختياري.

المفاتيح بتتحط في صفحة Hugging Face بس، وماتتبعتش لحد.

## ٤) ملف التشغيل (Dockerfile)

1. افتح: https://huggingface.co/spaces/sham3331/sham-robots/new/main
   (أو: **Files** (الملفات) ← **+ Add file** أو **Contribute** ← **Create a new file** (ملف جديد)).
2. في خانة اسم الملف اكتب بالظبط: `Dockerfile`
3. في المربع الكبير الصق السطور دي:

```
FROM node:22-bookworm-slim
ADD https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/scripts/robots/space-setup.sh /space-setup.sh
RUN bash /space-setup.sh
USER node
ENV HOME=/home/node PORT=7860 ROBOTS_WORK_DIR=/home/node/work
CMD ["bash", "/boot.sh"]
```

   نفس السطور دي موجودة هنا كمان لو حبيت تنسخها من GitHub:
   https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/scripts/robots/huggingface/Dockerfile
4. انزل ودوس **Commit new file to main** (احفظ الملف).

لو لقيت ملف اسمه `Dockerfile` موجود قبل كده: افتحه ودوس **Edit** (تعديل)، امسح كل اللي فيه، والصق السطور اللي فوق.

## ٥) استنى وافتح

- فوق هيظهر **Building** (بيتبني)، وبعد 5 لـ 10 دقايق هيبقى **Running** (شغال).
- افتح https://sham3331-sham-robots.hf.space هتلاقي صفحة «سيرفر روبوتات شام 🤖».
- أول دقيقتين ممكن تشوف «سيرفر الروبوتات بيتجهز…». ده طبيعي، لأنه بيحمّل مكتبات الموقع.
- خريطة التشغيل في لوحة التحكم بتقرأ العنوان ده لوحدها (`ROBOTS_SERVER_URLS` في `src/utils/opsLive.ts`).

## ملاحظات

- **النوم:** الـ Space المجاني بينام لو محدش زاره 48 ساعة. السيرفر بيزور نفسه كل 10 دقايق، وخريطة التشغيل بتصحّيه كمان. لو لقيته نايم (**Sleeping**)، افتح العنوان أو دوس **Restart** (إعادة تشغيل).
- **إعادة التشغيل:** لما الـ Space يقف أو يتعاد تشغيله، السيرفر بينشر نتايج اليوم في لقطة واحدة قبل ما يقف.
- **الخطوات التقيلة:** المعلم المحلي ومنقّح الصور والمتصفح متسابة دلوقتي (`ROBOTS_HEAVY=0`). تقدر تجربها بإنك تضيف متغير (**New variable**) اسمه `ROBOTS_HEAVY` وقيمته `1`.
- **وقف كل المواعيد:** متغير اسمه `ROBOTS_ENABLED` وقيمته `0`.
- **تحديث الكود:** السيرفر بياخد كود الموقع الجديد من GitHub لوحده بعد كل لقطة يومية. لو اتغير `boot.sh` أو `space-setup.sh`، ادخل على **Settings** (الإعدادات) ودوس **Factory rebuild** (إعادة بناء).
- **Render:** لسه بديل لو حبيت (`docs/RENDER_ROBOTS.md`)، والخريطة بتجرب عنوانه بعد عنوان Hugging Face.
