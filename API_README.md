# Sham Perfume API

FastAPI REST API لمنصة عطور الشام - نظام الوساطة في مبيعات العطور

## التثبيت

```bash
pip install -r api/requirements.txt
```

## التشغيل

```bash
# تطوير
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# إنتاج
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

## قاعدة البيانات

يستخدم SQLite تلقائيًا. يمكن تغيير المسار عبر متغير البيئة `DB_PATH`.

الجداول:
- `suppliers` - الموردون (Lattafa, Al-Rehab, إلخ)
- `products` - المنتجات مع الـ markup 50%
- `orders` - الطلبات وإدارة الحالة
- `scrape_sessions` - جلسات الـ scraping

## النهايات (Endpoints)

### المنتجات
| الطريقة | النهاية | الوصف |
|--------|--------|-------|
| GET | `/products` | قائمة جميع المنتجات |
| GET | `/products/{id}` | منتج محدد |
| GET | `/products/search/{query}` | بحث عن 이름으로 |
| GET | `/products/count` | عدد المنتجات |
| POST | `/products/` | إضافة منتج جديد |

### الموردون
| الطريقة | النهاية | الوصف |
|--------|--------|-------|
| GET | `/suppliers` | قائمة الموردين |
| GET | `/suppliers/{id}` | مورد محدد |
| POST | `/suppliers` | إضافة مورد جديد |

### الطلبات
| الطريقة | النهاية | الوصف |
|--------|--------|-------|
| GET | `/orders` | قائمة الطلبات |
| GET | `/orders/{id}` | 주문 محدد |
| POST | `/orders` | إنشاء طلب جديد |
| PUT | `/orders/{id}/status` | تحديث حالة الطلب |

### جذر
| الطريقة | النهاية | الوصف |
|--------|--------|-------|
| GET | `/` | معلومات API |

## مثال الاستخدام

### إضافة منتج
```bash
curl -X POST http://localhost:8000/products/ \
  -H "Content-Type: application/json" \
  -d '{"sku": "LAT-001", "name_ar": "عطر لطافة", "supplier_price": 35.0, "brand": "Lattafa"}'
```

الرد يحتوي على `our_price` محسوب تلقائيًا (50% markup).

### إنشاء 주문
```bash
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "cust-001", "product_id": 1, "quantity": 2}'
```

## تكامل مع الـ Scraper

يستطيع الـ scraper إضافة المنتجات مباشرة عبر API:
1. scrape البيانات من الموقع
2. POST إلى `/products/` مع البيانات
3. النظام يحسب الـ our_price تلقائيًا

## ملاحظات التكوين

- `DB_PATH`: مسار قاعدة البيانات (افتراضي: `sham_perfume.db`)
- CORS مفعل لجميع المصادر (`allow_origins=["*"]`)
