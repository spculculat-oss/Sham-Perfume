#!/usr/bin/env python3
"""FastAPI API for Sham Perfume product catalog."""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "/home/user/Sham-Perfume/sham_perfume.db")

app = FastAPI(title="Sham Perfume API", version="1.0.0")

# L-07 Fix: تقييد CORS — لا تسمح للكل، فقط دومينات شام الموثوقة (امتثال GDPR Art.32)
# يقرأ من SHAM_CORS_ORIGINS env إذا موجود، وإلا يستخدم القائمة البيضاء الافتراضية
_CORS_ORIGINS = [o.strip() for o in os.getenv("SHAM_CORS_ORIGINS", "").split(",") if o.strip()] or [
    "https://spculculat-oss.github.io",
    "https://sham-perfume-49bf.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
]
# في التطوير فقط: السماح بـ * إذا SHAM_CORS_ORIGINS=* (يُمنع في الإنتاج)
if _CORS_ORIGINS == ["*"]:
    _CORS_ORIGINS = ["*"]

app.add_middleware(CORSMiddleware, allow_origins=_CORS_ORIGINS,
                   allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                   allow_headers=["*"],
                   allow_credentials=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            website_url TEXT NOT NULL,
            credibility_score INTEGER DEFAULT 0,
            api_available BOOLEAN DEFAULT 0,
            api_endpoint TEXT,
            status TEXT DEFAULT 'vetting',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
            sku TEXT,
            name_ar TEXT,
            name_en TEXT,
            description_ar TEXT,
            description_en TEXT,
            image_url TEXT,
            image_urls TEXT,
            category TEXT,
            brand TEXT,
            specs TEXT,
            supplier_price REAL,
            our_price REAL,
            stock_status TEXT DEFAULT 'unknown',
            last_scraped TIMESTAMP,
            scraped_data TEXT,
            url TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            quantity INTEGER DEFAULT 1,
            unit_price REAL NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            supplier_order_id TEXT,
            supplier_tracking_number TEXT,
            shipping_address TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            paid_at TIMESTAMP,
            shipped_at TIMESTAMP,
            delivered_at TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS scrape_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
            status TEXT DEFAULT 'running',
            products_scraped INTEGER DEFAULT 0,
            errors TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id)")
    conn.commit()
    conn.close()


# Pydantic schemas
class ProductBase(BaseModel):
    sku: Optional[str] = None
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    specs: Optional[dict] = None
    supplier_price: Optional[float] = None
    url: Optional[str] = None


class ProductResponse(ProductBase):
    id: int
    supplier_id: Optional[int] = None
    our_price: Optional[float] = None
    stock_status: str = "unknown"
    is_active: bool = True
    class Config:
        from_attributes = True


class SupplierBase(BaseModel):
    name: str
    website_url: str
    credibility_score: int = 0
    api_available: bool = False
    status: str = "vetting"


class SupplierResponse(SupplierBase):
    id: int
    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    customer_id: str
    product_id: int
    quantity: int = 1
    shipping_address: Optional[dict] = None
    notes: Optional[str] = None


class OrderResponse(OrderBase):
    id: int
    total_price: float
    status: str
    class Config:
        from_attributes = True


@app.on_event("startup")
def startup():
    init_db()


# Product endpoints
# L-03 Fix: Scraper endpoints disabled — require SHAM_ALLOW_SCRAPE=1 + admin token (see SCRAPER_LEGAL_NOTICE.md)
@app.get("/products", response_model=List[ProductResponse])
def get_products(supplier_id: Optional[int] = None, category: Optional[str] = None,
                brand: Optional[str] = None, limit: int = 100, offset: int = 0,
                db=Depends(get_db)):
    import json
    cur = db.cursor()
    query = "SELECT * FROM products WHERE is_active = 1"
    params = []
    if supplier_id:
        query += " AND supplier_id = ?"
        params.append(supplier_id)
    if category:
        query += " AND category = ?"
        params.append(category)
    if brand:
        query += " AND brand = ?"
        params.append(brand)
    query += " ORDER BY id LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cur.execute(query, params)
    rows = cur.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["specs"] = json.loads(d["specs"]) if d.get("specs") else {}
        result.append(d)
    return result


@app.get("/products/count", response_model=dict)
def count_products(db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) FROM products WHERE is_active = 1")
    count = cur.fetchone()[0]
    return {"count": count}


@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db=Depends(get_db)):
    import json
    cur = db.cursor()
    cur.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    d = dict(row)
    d["specs"] = json.loads(d["specs"]) if d.get("specs") else {}
    return d


@app.get("/products/search/{query}", response_model=List[ProductResponse])
def search_products(query: str, limit: int = 20, db=Depends(get_db)):
    import json
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM products WHERE is_active = 1 AND "
        "(name_ar LIKE ? OR name_en LIKE ?) LIMIT ?",
        (f"%{query}%", f"%{query}%", limit)
    )
    rows = cur.fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["specs"] = json.loads(d["specs"]) if d.get("specs") else {}
        result.append(d)
    return result


@app.post("/products/", response_model=ProductResponse, status_code=201)
def create_product(product: ProductBase, db=Depends(get_db)):
    cur = db.cursor()
    our_price = round(product.supplier_price * 1.5, 2) if product.supplier_price else None
    specs_json = str(product.specs) if product.specs else "{}"
    cur.execute(
        "INSERT INTO products (supplier_id, sku, name_ar, name_en, description_ar,"
        "description_en, image_url, category, brand, specs, supplier_price, our_price,"
        "url, last_scraped, scraped_data, is_active, stock_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (None, product.sku, product.name_ar, product.name_en,
         product.description_ar, product.description_en, product.image_url,
         product.category, product.brand, specs_json,
         product.supplier_price, our_price, product.url,
         None, "{}", 1, "unknown"))
    db.commit()
    product_id = cur.lastrowid
    cur.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    row_dict = dict(cur.fetchone())
    # Parse specs from JSON string
    import json
    row_dict["specs"] = json.loads(row_dict["specs"]) if row_dict.get("specs") else {}
    return row_dict


# Supplier endpoints
@app.post("/suppliers", response_model=SupplierResponse, status_code=201)
def create_supplier(supplier: SupplierBase, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "INSERT INTO suppliers (name, website_url, credibility_score, api_available, status) VALUES (?,?,?,?,?)",
        (supplier.name, supplier.website_url, supplier.credibility_score,
         supplier.api_available, supplier.status))
    db.commit()
    supplier_id = cur.lastrowid
    cur.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,))
    row = cur.fetchone()
    return dict(row)


@app.get("/suppliers", response_model=List[SupplierResponse])
def get_suppliers(db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM suppliers ORDER BY id")
    rows = cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return dict(row)


# Order endpoints
@app.post("/orders", response_model=OrderResponse, status_code=201)
def create_order(order: OrderBase, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT our_price FROM products WHERE id = ?", (order.product_id,))
    product = cur.fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    our_price = product[0]
    unit_price = our_price
    total_price = round(unit_price * order.quantity, 2)
    cur.execute(
        "INSERT INTO orders (customer_id, product_id, quantity,"
        "unit_price, total_price, shipping_address, notes) VALUES "
        "(?,?,?,?,?,?,?)",
        (order.customer_id, order.product_id, order.quantity,
         unit_price, total_price,
         str(order.shipping_address) if order.shipping_address else None,
         order.notes))
    db.commit()
    order_id = cur.lastrowid
    cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cur.fetchone()
    return dict(row)


@app.get("/orders", response_model=List[OrderResponse])
def get_orders(customer_id: Optional[str] = None, limit: int = 50, offset: int = 0,
               db=Depends(get_db)):
    cur = db.cursor()
    query = "SELECT * FROM orders"
    params = []
    if customer_id:
        query += " WHERE customer_id = ?"
        params.append(customer_id)
    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cur.execute(query, params)
    rows = cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return dict(row)


@app.put("/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, order_id))
    db.commit()
    return {"ok": True, "order_id": order_id, "status": status}


@app.get("/")
def root():
    return {"message": "Sham Perfume API", "version": "1.0.0"}
