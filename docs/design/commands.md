# الأوامر المُستخدمة (Commands Reference)

## أستخدامات شائعة

### 1. 빌드 و نشر

```bash
# تثبيت dependencies
npm install --legacy-peer-deps

# تشغيل التطوير (local)
npm run dev

# بناء الـ Pages (GitHub Pages)
npm run build:pages

# فحص TypeScript errors
npm run lint

# معاينة الـ build
npm run preview
```

### 2. إدارة المنتجات

```bash
# تثبيت dependencies للتعديل
pip3 install beautifulsoup4 requests --break-system-packages

# إضافة منتجات من Shama Perfumes
python3 << 'EOF'
import json
from datetime import datetime

new_products = [
    {"id": 20, "nameAr": "عطر داهب", "nameEn": "Dahab", "brand": "Shama", ...},
    ...
]

d = json.load(open('src/data/products.json'))
for np in new_products:
    np['ourPrice'] = round(np['supplierPrice'] * 1.5, 2)
    d['products'].append(np)

with open('src/data/products.json', 'w') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
EOF
```

### 3. Shaheen Doctor

```bash
# تشغيل الفحص
python3 scripts/doctor/shaheen_doctor.py

# تشغيل الإصلاح
python3 scripts/doctor/auto_fixer.py

# تشغيل daemon (متابعة مستمرة)
DOCTOR_DAEMON=1 python3 scripts/doctor/shaheen_doctor.py
```

### 4. GitHub Operations

```bash
# فحص الـ branches
git branch -a
git status

# إنشاء commit
git add -A
git commit -m "description"

# دفع التغييرات
git push origin <branch-name>

# إنشاء PR
gh pr create --title "title" --body "description"

# دمج PR
gh pr merge <number> --merge

# فحص الـ Runs
gh run list --limit 5
gh run view <run-id>
```

### 5. Docker/Deployment

```bash
# لمشروع Sham-Perfume
# لا يحتاج Docker - يستخدم GitHub Pages + Vercel
```

---

## الأوامر المتخصصة

### 添加 منتجات جديدة

```bash
# إضافة 32 منتج من Shama
python3 << 'SCRIPT'
import json

new_products = [
    {"nameAr": "عطر داهب", "brand": "Shama", "supplierPrice": 300, ...},
    ...
]

d = json.load(open('src/data/products.json'))
for product in new_products:
    product['ourPrice'] = round(product['supplierPrice'] * 1.5, 2)
    product['id'] = max(p['id'] for p in d['products']) + 1
    d['products'].append(product)

with open('src/data/products.json', 'w') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
SCRIPT
```

### إضافة صور للمنتجات

```bash
# تحديث صور المنتجات من Unsplash
python3 << 'SCRIPT'
import json

product_images = {
    1: "https://images.unsplash.com/photo-1594032445763-59aef710e0ba?w=300&h=300&fit=crop",
    2: "https://images.unsplash.com/photo-1612406687582-f4458119aa5a?w=300&h=300&fit=crop",
    ...
}

d = json.load(open('src/data/products.json'))
for p in d['products']:
    p['imageUrl'] = product_images.get(p['id'], product_images[1])

with open('src/data/products.json', 'w') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
SCRIPT
```

### إصلاح أخطاء TypeScript

```bash
# When lint fails
npm run lint

# Fixes usually:
# 1. Add missing imports
# 2. Fix type mismatches
# 3. Add missing properties to interfaces
```

### تشغيل Shaheen Doctor

```bash
# فحص كامل
python3 scripts/doctor/shaheen_doctor.py

# إصلاح تلقائي
python3 scripts/doctor/auto_fixer.py

# معاينة الـ Workflow
gh run list --workflow="Build, test and deploy Pages" --limit 3
```

---

## نقاط الاهتمام

1. **50% Markup**: كل منتج بيعمل سعرنا = السعر الإدخاري * 1.5
2. **Images**: كل الصور من Unsplash (مجاناً، عالية الجودة)
3. **Product IDs**: متصاعدة من 1 لـ 51 حالياً
4. **Brands**: Lattafa, Rasasi, Al-Rehab, Shama, Dior, YSL, Baccarat, De Pronom

---

## نموذج Command كامل

```bash
# بناء المشروع وإضافة منتجات
cd /home/user/Sham-Perfume

# 1. تثبيت dependencies
npm install --legacy-peer-deps

# 2. إضافة منتجات جديدة (مثال: 32 منتج من Shama)
python3 scripts/scraper/add_products.py

# 3. تحديث الصور
python3 scripts/scraper/add_products.py --update-images

# 4. فحص الـ TypeScript
npm run lint

# 5. بناء الـ Pages
npm run build:pages

# 6. فحص الـ Doctor
python3 scripts/doctor/shaheen_doctor.py

# 7. دفع التغييرات
git add -A
git commit -m "update: add products, fix images"
git push origin <branch>

# 8. إنشاء PR
gh pr create --title "update" --body "description"
```
