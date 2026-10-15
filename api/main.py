#!/usr/bin/env python3
"""FastAPI API for Sham Perfume product catalog."""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import psycopg2
import os

app = FastAPI(title="Sham Perfume API", version="1.0.0")

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Database connection
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "sham_perfume")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

def get_db():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    try:
        yield conn
    finally:
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
    supplier_price: Optional[float] = None
    url: Optional[str] = None


class ProductResponse(ProductBase):
    id: int
    supplier_id: int
    our_price: float
    stock_status: str
    is_active: bool
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


# Product endpoints
@app.get("/products", response_model=List[ProductResponse])
def get_products(supplier_id: Optional[int] = None, category: Optional[str] = None,
                brand: Optional[str] = None, limit: int = 100, offset: int = 0,
                db=Depends(get_db)):
    cur = db.cursor()
    query = "SELECT * FROM products WHERE is_active = TRUE"
    params = []
    if supplier_id:
        query += " AND supplier_id = %s"
        params.append(supplier_id)
    if category:
        query += " AND category = %s"
        params.append(category)
    if brand:
        query += " AND brand = %s"
        params.append(brand)
    query += " ORDER BY id LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    cur.execute(query, params)
    rows = cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return dict(row)


@app.get("/products/search/{query}", response_model=List[ProductResponse])
def search_products(query: str, limit: int = 20, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "SELECT * FROM products WHERE is_active = TRUE AND "
        "(name_ar ILIKE %s OR name_en ILIKE %s) LIMIT %s",
        (f"%{query}%", f"%{query}%", limit)
    )
    rows = cur.fetchall()
    return [dict(r) for r in rows]


@app.post("/products/", response_model=ProductResponse, status_code=201)
def create_product(product: ProductBase, db=Depends(get_db)):
    cur = db.cursor()
    our_price = round(product.supplier_price * 1.5, 2) if product.supplier_price else None
    cur.execute(
        "INSERT INTO products (supplier_id, sku, name_ar, name_en, description_ar, "
        "description_en, image_url, category, brand, specs, supplier_price, our_price, "
        "url, last_scraped, scraped_data, is_active, stock_status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,"
        "%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (product.sku, product.name_ar, product.name_en,
         product.description_ar, product.description_en, product.image_url,
         product.category, product.brand, {},
         product.supplier_price, our_price, product.url,
         None, {}, True, "unknown"))
    product_id = cur.lastrowid
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    row = cur.fetchone()
    return dict(row)


@app.get("/products/count", response_model=dict)
def count_products(db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT COUNT(*) FROM products WHERE is_active = TRUE")
    count = cur.fetchone()[0]
    return {"count": count}


# Supplier endpoints
@app.get("/suppliers", response_model=List[SupplierResponse])
def get_suppliers(db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM suppliers ORDER BY id")
    rows = cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM suppliers WHERE id = %s", (supplier_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return dict(row)


# Order endpoints
@app.post("/orders", response_model=OrderResponse, status_code=201)
def create_order(order: OrderBase, db=Depends(get_db)):
    cur = db.cursor()
    total_price = round(order.quantity * 1.5 * 100, 2)  # Simplified pricing
    cur.execute(
        "INSERT INTO orders (customer_id, product_id, quantity, "
        "unit_price, total_price, shipping_address, notes) VALUES "
        "(%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (order.customer_id, order.product_id, order.quantity,
         100.0, total_price, order.shipping_address, order.notes))
    order_id = cur.fetchone()[0]
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    row = cur.fetchone()
    return dict(row)


@app.get("/orders", response_model=List[OrderResponse])
def get_orders(customer_id: Optional[str] = None, limit: int = 50, offset: int = 0,
               db=Depends(get_db)):
    cur = db.cursor()
    query = "SELECT * FROM orders"
    params = []
    if customer_id:
        query += " WHERE customer_id = %s"
        params.append(customer_id)
    query += " ORDER BY id DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])
    cur.execute(query, params)
    rows = cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return dict(row)


@app.put("/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s",
        (status, order_id))
    return {"ok": True, "order_id": order_id, "status": status}


@app.get("/")
def root():
    return {"message": "Sham Perfume API", "version": "1.0.0"}
