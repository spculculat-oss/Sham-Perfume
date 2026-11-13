# الهندسة المعمارية (Architecture)

## 1. نظام المتجر (Store System)

### المكونات

```
┌─────────────────────────────────────────────────────────────┐
│                      React Application                       │
│  (TypeScript, Vite, TailwindCSS, Lucide Icons)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   HomeHub    │    │  Storefront  │    │ProductDetail │  │
│  │  (13 Portals)│    │  (Karousel)  │    │  (Specs)     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              App.tsx (Hash Router)                  │   │
│  │  - handleHashChange()                             │   │
│  │  - handlePopState()                               │   │
│  │  - activeTab === 'store'                         │   │
│  │  - activeTab === 'productDetail'                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    products.json                             │
│  - 51 products with 50% markup                              │
│  - Each has: id, sku, nameAr, nameEn, imageUrl,           │
│    category, brand, supplierPrice, ourPrice,               │
│    stockStatus, isFeatured, isNew, rating,                │
│    reviewCount, unit, createdAt, updatedAt                 │
└─────────────────────────────────────────────────────────────┘
```

### Storefront Features

1. **Karousel**: Featured products (5 sec rotation)
2. **New Arrivals**: Latest 6 products sorted by date
3. **Brand Filter**: Dropdown with 8 brands
4. **Sort Options**: Newest, Price Low-High, Price High-Low
5. **Search**: Real-time filter with product count
6. **Cart**: Add/remove, total calculation
7. **Merchant Registration**: Modal form

---

## 2. نظام Scraping

```
┌─────────────────────┐     ┌─────────────────────┐
│  Source Websites    │     │  Scraped Data       │
│  - shamperfume.com  │     │  - nameAr/nameEn    │
│  - shama-perfumes.com│    │  - imageUrl         │
│  - Other sites      │     │  - supplierPrice    │
└─────────────────────┘     │  - category         │
                            │  - brand            │
                            └──────────┬──────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Product Pipeline                        │
│  - Validate data                                            │
│  - Clean names                                              │
│  - Assign brand                                             │
│  - Generate SKU                                             │
│  - Apply 50% markup                                         │
└─────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    products.json                            │
│  (Added to existing products array)                        │
└─────────────────────────────────────────────────────────────┘
```

### Scrapers Available

1. **ShamPerfumeScraper**: shamperfume.com
2. **AddProductsScript**: Generic product addition
3. **AutoFixer**: Fix missing product data

---

## 3. نظام Shaheen Doctor

```
┌─────────────────────────────────────────────────────────────┐
│                    ShaheenDoctor Agent                      │
│  (Python + TypeScript Implementation)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │  Self-Check │    │  Auto-Fix   │    │  Schedule   │    │
│  │  - every 10m│    │  - Fix      │    │  - GitHub   │    │
│  │  - Report   │    │  - Monitor  │    │    Actions  │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│                                                              │
│  Check Points:                                              │
│  1. products.json validity                                 │
│  2. Store page accessibility                               │
│  3. Product image loading                                  │
│  4. GitHub Actions workflow status                         │
│                                                              │
│  Fix Operations:                                            │
│  1. Add missing images (from brand pool)                   │
│  2. Add missing descriptions                               │
│  3. Fix missing dates                                      │
│  4. Fix missing required fields                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. GitHub Actions Workflows

### 1. Build & Deploy Pages
```yaml
name: Build, test and deploy Pages
on:
  push:
    branches: [main]
  pull_request:
jobs:
  - name: Build
    run: npm run build:pages
  - name: Check Pages
    run: npm run check:pages
```

### 2. Shaheen Doctor
```yaml
name: Shaheen Doctor (Automated Maintenance)
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
jobs:
  - name: Doctor Check
    run: python scripts/doctor/shaheen_doctor.py
```

---

## 5. Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | TailwindCSS |
| Icons | Lucide React |
| State | React useState/useEffect |
| Data | JSON (products.json) |
| Build | Vite |
| Hosting | GitHub Pages |
| API | FastAPI (Python) |
| Database | SQLite (sham_perfume.db) |
| Scraper | Python, BeautifulSoup |
| Doctor | Python, TypeScript |

---

## 6. Product Data Flow

```
External Sites → Scraper → Product Pipeline → products.json
                                                  ↓
                                           Storefront (React)
                                                  ↓
                                            GitHub Pages
```

---

## 7. Routing

```
Hash Routing:
- #home → HomeHub (default)
- #store → Storefront
- #product=<id> → ProductDetail
- #formula → ConcentrationCalculator
- #spec → ManufacturingSpecSheet
- #costing → CostCalculator
- ... (other tools)
```

---

## 8. 제품 Categories (المنتجات)

```
Categories in Store:
- All
- رجالي (Men)
- نسائي (Women)
- جديد (New)

Product Brands:
- Lattafa (5)
- Rasasi (2)
- Al-Rehab (5)
- Shama (32)
- Dior (1)
- YSL (1)
- Baccarat (1)
- De Pronom (1)
```

---

## 9. Pricing Logic

```javascript
// 50% Markup
ourPrice = supplierPrice * 1.5;

// Example:
// supplierPrice = 100 EGP → ourPrice = 150 EGP
// supplierPrice = 35 EGP → ourPrice = 52.5 EGP
```
