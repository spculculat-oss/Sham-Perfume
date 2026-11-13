# دزاين - مرجع التصميم والأوامر

フォルダ: `docs/design/`

هذا المجلد يحتوي على جميع الأوامر والمنطقيات المستخدمة في بناء مشروع Sham Perfume Store.

---

## هيكل المشروع

```
Sham-Perfume/
├── docs/
│   └── design/          # مرجع التصميم (هذا الفولدر)
├── src/
│   ├── components/      # React components
│   │   ├── Storefront.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── Header.tsx
│   │   └── ...
│   ├── data/
│   │   └── products.json # قاعدة بيانات المنتجات
│   └── App.tsx          # تطبيق React الرئيسي
├── scripts/
│   ├── scraper/         # نظام scraping
│   │   ├── shamperfume_scraper.py
│   │   ├── add_products.py
│   │   └── main.py
│   └── doctor/          # نظام Shaheen Doctor
│       ├── shaheen_doctor.py
│       ├── auto_fixer.py
│       ├── agent.ts
│       └── ...
├── .github/
│   └── workflows/
│       ├── pages.yml
│       └── shaheen-doctor.yml
└── api/
    └── main.py          # FastAPI API
```

---

## الأوامر الأساسية

### 1. بناء المشروع

```bash
# تثبيت Dependencies
npm install --legacy-peer-deps

# تشغيل التطوير
npm run dev

# بناء الـ Pages
npm run build:pages

# فحص TypeScript
npm run lint
```

### 2. إدارة المنتجات

```bash
# إضافة منتجات جديدة
python3 scripts/scraper/add_products.py

# تثبيت Dependencies للتعديل
pip3 install beautifulsoup4 requests --break-system-packages

# إضافة منتجات من Shama Perfumes
python3 << 'EOF'
import json
# ... product data here
EOF
```

### 3. نظام Shaheen Doctor

```bash
# تشغيل الفحص
python3 scripts/doctor/shaheen_doctor.py

# تشغيل الإصلاح
python3 scripts/doctor/auto_fixer.py

# معاينة الـ Workflow
gh run list --limit 5
```

### 4. GitHub Operations

```bash
# إنشاء PR
gh pr create --title "..." --body "..."

# دمج PR
gh pr merge <number> --merge

# فحص الـ Build
gh run list --limit 5
gh run view <id>
```

---

## المنطقيات (Logics)

### 1. Store Navigation Logic

**File**: `src/App.tsx`

```typescript
// Hash routing for store
handleHashChange = () => {
  const hash = window.location.hash.replace('#', '').split('?')[0];
  const target = hash === 'formula' || hash === 'spec' ? 'concentration' : 
                hash === 'store' ? 'store' : (hash || 'home');
  setActiveTab(target);
};

// Product detail routing
const productMatch = hash.match(/^product=(\d+)$/);
if (productMatch) {
  const productId = parseInt(productMatch[1]);
  setActiveTab('productDetail');
  setProductId(productId);
}
```

### 2. Product Data Structure

**File**: `src/data/products.json`

```json
{
  "products": [
    {
      "id": 1,
      "sku": "LAT-001",
      "nameAr": "عطر لطافة سوداء",
      "nameEn": "Lattafa Black Oud",
      "descriptionAr": "عطر رجالي فاخر...",
      "descriptionEn": "Luxurious men's perfume...",
      "imageUrl": "https://images.unsplash.com/...",
      "category": "رجالي",
      "brand": "Lattafa",
      "supplierPrice": 35.0,
      "ourPrice": 52.5,  // 50% markup
      "stockStatus": "in_stock",
      "isFeatured": true,
      "isNew": true,
      "rating": 4.0,
      "reviewCount": 120,
      "unit": "قطن",
      "createdAt": "2026-10-15 12:53:28",
      "updatedAt": "2026-10-15 12:53:28"
    }
  ]
}
```

### 3. Storefront Component

**File**: `src/components/Storefront.tsx`

```typescript
// المتجر كامل مع:
// - Featured Products carousel (5 sec interval)
// - New Arrivals section (sorted by createdAt)
// - Brand filter dropdown
// - Sort options (Newest, Price Low-High, Price High-Low)
// - Search with results count
// - Add to Cart functionality
// - Merchant registration modal
// - Cart sidebar
```

### 4. Product Detail Component

**File**: `src/components/ProductDetail.tsx`

```typescript
// صفحة تفاصيل المنتج مع:
// - Image display
// - Product specifications
// - Add to Cart
// - Related products (same brand)
// - Price with discount
// - Shipping & guarantee info
```

### 5. Shaheen Doctor Logic

**File**: `scripts/doctor/shaheen_doctor.py`

```python
class ShaheenDoctor:
    """Automated AI maintenance agent."""
    
    def check_products_file(self):
        """Check products.json validity"""
        
    def check_store_page(self):
        """Check store page accessibility"""
        
    def check_product_images(self):
        """Check if images are loading"""
        
    def check_workflow_status(self):
        """Check GitHub Actions status"""
        
    def auto_fix(self):
        """Attempt to fix detected issues"""
        
    def run_cycle(self):
        """Run one complete monitoring cycle"""
```

### 6. Auto-Fixer Logic

**File**: `scripts/doctor/auto_fixer.py`

```python
def fix_products():
    """Fix products issues:
    - Missing images (assign from brand image pool)
    - Missing descriptions (generate default)
    - Missing dates (set current date)
    - Missing unit (set default 'قطن')
    """
    
def fix_workflow():
    """Check GitHub Actions workflow status"""
```

---

## منصات الـ Products اللي استخدمناها

### Lattafa (5 منتجات)
- Black Oud, Fakhar, White, GX, Night

### Rasasi (2 منتجات)
- Khamrah, Hakli

### Al-Rehab (5 منتجات)
- Malika, Ramad, Dubai, Asal, Ward

### Shama Perfumes (32 منتج)
- Perfumes: Dahab, Layl, Amiri, Mirage, Khanjar, Fidji, White Oud, Reem, Khalifa, No.5, Safwa, Wadi, Sama, 1977, Taif, Sougha, Raghad
- Oud: Oud Ma'attar, Hindi Digga (3 types), Hindi Syufi (2 types), Hindi Digga Khas
- Dehnal Oud: Asli, Khussusi, Kalakasi, Silani, Hindi Ateeq, Royal Philippini
- Gift Sets: Oud Discovery, Royal Oil, Legacy Mukhallat

### أخرى (4 منتجات)
- De Pronom, Dior, YSL, Baccarat

---

## جدول السعر (50% Markup)

| المنتج | سعر التوريد | سعرنا |
|--------|------------|--------|
| Lattafa Black Oud | 35 EGP | 52.5 EGP |
| Lattafa Fakhar | 28 EGP | 42 EGP |
| Al-Rehab Malika | 15 EGP | 22.5 EGP |
| Shama Dahab | 300 EGP | 450 EGP |
| Shama Layl | 225 EGP | 337.5 EGP |
| Shama Oud Ma'attar | 100 EGP | 150 EGP |
| ... | ... | ... |

**المجموع**: 51 منتج = 12,421.5 EGP

---

## روابط مهمة

- **الموقع**: https://spculculat-oss.github.io/Sham-Perfume/#store
- **GitHub**: https://github.com/spculculat-oss/Sham-Perfume
- **Pages Workflow**: https://github.com/spculculat-oss/Sham-Perfume/actions

---

## TODO List

### ✅ Completed
- [x] Store navigation (store hash routing)
- [x] Products with 50% markup
- [x] Product images (Unsplash)
- [x] Product detail pages
- [x] Brand filter
- [x] Sort options
- [x] Shaheen Doctor agent
- [x] Auto-fixer
- [x] Scheduled workflow (every 10 minutes)

### ⏳ In Progress
- [ ] Scraping more products from external sites
- [ ] Advanced search with filters
- [ ] Better image sources

### 🔲 TODO
- [ ] Add more product categories
- [ ] Improve product descriptions
- [ ] Add review system
- [ ] Order management integration
