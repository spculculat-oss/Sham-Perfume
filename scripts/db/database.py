#!/usr/bin/env python3
"""Database connection for Sham Perfume catalog."""

from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timezone


@dataclass
class ProductData:
    sku: Optional[str] = None
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: List[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    supplier_price: Optional[float] = None
    specs: Dict[str, Any] = None
    url: Optional[str] = None
    scraped_at: str = None
    supplier_id: Optional[int] = None

@dataclass
class ScrapeSession:
    supplier_id: int
    status: str = 'running'
    products_scraped: int = 0
    errors: List[str] = None
    started_at: str = None
    completed_at: Optional[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.started_at is None:
            self.started_at = datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, host='localhost', port=5432, dbname='sham_perfume',
                 user='postgres', password='postgres'):
        self.conn_params = dict(host=host, port=port, dbname=dbname,
                                 user=user, password=password)
        self.conn = None

    def connect(self):
        import psycopg2
        self.conn = psycopg2.connect(**self.conn_params)
        self.conn.autocommit = True
        self._init_schema()

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None

    def _init_schema(self):
        c = self.conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                website_url TEXT NOT NULL,
                credibility_score INTEGER DEFAULT 0,
                api_available BOOLEAN DEFAULT FALSE,
                api_endpoint TEXT,
                status VARCHAR(50) DEFAULT 'vetting',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
                sku VARCHAR(255),
                name_ar TEXT,
                name_en TEXT,
                description_ar TEXT,
                description_en TEXT,
                image_url TEXT,
                image_urls TEXT[] DEFAULT '{}',
                category VARCHAR(100),
                brand VARCHAR(100),
                specs JSONB DEFAULT '{}',
                supplier_price DECIMAL(10,2),
                our_price DECIMAL(10,2),
                stock_status VARCHAR(50) DEFAULT 'unknown',
                last_scraped TIMESTAMP,
                scraped_data JSONB DEFAULT '{}',
                url TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(255) NOT NULL,
                product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
                quantity INTEGER DEFAULT 1,
                unit_price DECIMAL(10,2) NOT NULL,
                total_price DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                supplier_order_id VARCHAR(255),
                supplier_tracking_number VARCHAR(255),
                shipping_address JSONB,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                paid_at TIMESTAMP,
                shipped_at TIMESTAMP,
                delivered_at TIMESTAMP
            );
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS scrape_sessions (
                id SERIAL PRIMARY KEY,
                supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'running',
                products_scraped INTEGER DEFAULT 0,
                errors TEXT[] DEFAULT '{}',
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);")
        self.conn.commit()

    def insert_supplier(self, name, website_url, credibility_score=0,
                        api_available=False, api_endpoint=None,
                        status='vetting'):
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO suppliers (name, website_url, credibility_score, "
                "api_available, api_endpoint, status) VALUES (%s,%s,%s,%s,%s,%s) "
                "RETURNING id",
                (name, website_url, credibility_score, api_available,
                 api_endpoint, status))
            return cur.fetchone()[0]

    def get_supplier(self, supplier_id):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM suppliers WHERE id = %s", (supplier_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def insert_product(self, supplier_id, product):
        our_price = round(product.supplier_price * 1.5, 2) if product.supplier_price else None
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO products (supplier_id, sku, name_ar, name_en, "
                "description_ar, description_en, image_url, category, brand, "
                "specs, supplier_price, our_price, url, last_scraped, "
                "scraped_data, is_active, stock_status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,"
                "%s,%s,%s,%s,%s,%s,%s)",
                (supplier_id, product.sku, product.name_ar, product.name_en,
                 product.description_ar, product.description_en, product.image_url,
                 product.category, product.brand, product.specs,
                 product.supplier_price, our_price, product.url,
                 product.scraped_at, product.scraped_data,
                 product.to_dict().get('is_active', True),
                 product.to_dict().get('stock_status', 'unknown')))
            return cur.lastrowid

    def update_product(self, product_id, product):
        our_price = round(product.supplier_price * 1.5, 2) if product.supplier_price else None
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE products SET sku=%s, name_ar=%s, name_en=%s, "
                "description_ar=%s, description_en=%s, image_url=%s, "
                "category=%s, brand=%s, specs=%s, supplier_price=%s, "
                "our_price=%s, url=%s, last_scraped=%s, scraped_data=%s, "
                "is_active=%s, stock_status=%s WHERE id=%s",
                (product.sku, product.name_ar, product.name_en,
                 product.description_ar, product.description_en, product.image_url,
                 product.category, product.brand, product.specs,
                 product.supplier_price, our_price, product.url,
                 product.scraped_at, product.scraped_data,
                 product.to_dict().get('is_active', True),
                 product.to_dict().get('stock_status', 'unknown'),
                 product_id))
            return product_id

    def get_product(self, product_id):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_products_by_supplier(self, supplier_id, limit=100, offset=0):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE supplier_id = %s AND is_active = TRUE "
                "ORDER BY id LIMIT %s OFFSET %s",
                (supplier_id, limit, offset))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_all_products(self, limit=100, offset=0):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE ORDER BY id LIMIT %s OFFSET %s",
                (limit, offset))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def search_products(self, query, limit=20):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE AND "
                "(name_ar ILIKE %s OR name_en ILIKE %s) LIMIT %s",
                (f'%{query}%', f'%{query}%', limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_products_by_category(self, category, limit=100):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE AND category = %s "
                "ORDER BY id LIMIT %s",
                (category, limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_products_by_brand(self, brand, limit=100):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE AND brand = %s "
                "ORDER BY id LIMIT %s",
                (brand, limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def create_order(self, customer_id, product_id, quantity, unit_price,
                     shipping_address=None, notes=None):
        total_price = round(unit_price * quantity, 2)
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO orders (customer_id, product_id, quantity, "
                "unit_price, total_price, shipping_address, notes) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (customer_id, product_id, quantity, unit_price, total_price,
                 shipping_address, notes))
            return cur.fetchone()[0]

    def update_order_status(self, order_id, status):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s",
                (status, order_id))

    def get_order(self, order_id):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_orders_by_customer(self, customer_id, limit=50, offset=0):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM orders WHERE customer_id = %s ORDER BY id DESC "
                "LIMIT %s OFFSET %s",
                (customer_id, limit, offset))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def update_order_tracking(self, order_id, supplier_order_id,
                               supplier_tracking_number):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET supplier_order_id = %s, "
                "supplier_tracking_number = %s WHERE id = %s",
                (supplier_order_id, supplier_tracking_number, order_id))

    def create_scrape_session(self, supplier_id):
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO scrape_sessions (supplier_id) VALUES (%s) "
                "RETURNING id",
                (supplier_id,))
            return cur.fetchone()[0]

    def update_scrape_session(self, session_id, status,
                               products_scraped=0, errors=None):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE scrape_sessions SET status = %s, products_scraped = %s, "
                "errors = %s WHERE id = %s",
                (status, products_scraped, errors, session_id))

    def complete_scrape_session(self, session_id):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE scrape_sessions SET status = 'completed', "
                "completed_at = NOW() WHERE id = %s",
                (session_id,))

    def get_supplier_by_name(self, name):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM suppliers WHERE name = %s", (name,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_products_by_supplier(self, supplier_id, limit=100, offset=0):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE supplier_id = %s AND is_active = TRUE "
                "ORDER BY id LIMIT %s OFFSET %s",
                (supplier_id, limit, offset))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_all_products(self, limit=100, offset=0):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE ORDER BY id LIMIT %s OFFSET %s",
                (limit, offset))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def search_products(self, query, limit=20):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE AND "
                "(name_ar ILIKE %s OR name_en ILIKE %s) LIMIT %s",
                (f"%{query}%", f"%{query}%", limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_products_by_category(self, category, limit=100):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE AND category = %s "
                "ORDER BY id LIMIT %s",
                (category, limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_products_by_brand(self, brand, limit=100):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM products WHERE is_active = TRUE AND brand = %s "
                "ORDER BY id LIMIT %s",
                (brand, limit))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_product(self, product_id):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def update_product(self, product_id, product):
        our_price = round(product.supplier_price * 1.5, 2) if product.supplier_price else None
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE products SET sku=%s, name_ar=%s, name_en=%s, "
                "description_ar=%s, description_en=%s, image_url=%s, "
                "category=%s, brand=%s, specs=%s, supplier_price=%s, "
                "our_price=%s, url=%s, last_scraped=%s, scraped_data=%s, "
                "is_active=%s, stock_status=%s WHERE id=%s",
                (product.sku, product.name_ar, product.name_en,
                 product.description_ar, product.description_en, product.image_url,
                 product.category, product.brand, product.specs,
                 product.supplier_price, our_price, product.url,
                 product.scraped_at, product.scraped_data,
                 product.to_dict().get('is_active', True),
                 product.to_dict().get('stock_status', 'unknown'),
                 product_id))
            return product_id

    def create_order(self, customer_id, product_id, quantity, unit_price,
                     shipping_address=None, notes=None):
        total_price = round(unit_price * quantity, 2)
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO orders (customer_id, product_id, quantity, "
                "unit_price, total_price, shipping_address, notes) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (customer_id, product_id, quantity, unit_price, total_price,
                 shipping_address, notes))
            return cur.fetchone()[0]

    def update_order_status(self, order_id, status):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s",
                (status, order_id))

    def get_order(self, order_id):
        with self.conn.cursor() as cur:
            cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_orders_by_customer(self, customer_id, limit=50, offset=0):
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM orders WHERE customer_id = %s ORDER BY id DESC "
                "LIMIT %s OFFSET %s",
                (customer_id, limit, offset))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def update_order_tracking(self, order_id, supplier_order_id,
                               supplier_tracking_number):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET supplier_order_id = %s, "
                "supplier_tracking_number = %s WHERE id = %s",
                (supplier_order_id, supplier_tracking_number, order_id))

    def create_scrape_session(self, supplier_id):
        with self.conn.cursor() as cur:
            cur.execute(
                "INSERT INTO scrape_sessions (supplier_id) VALUES (%s) "
                "RETURNING id",
                (supplier_id,))
            return cur.fetchone()[0]

    def update_scrape_session(self, session_id, status,
                               products_scraped=0, errors=None):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE scrape_sessions SET status = %s, products_scraped = %s, "
                "errors = %s WHERE id = %s",
                (status, products_scraped, errors, session_id))

    def complete_scrape_session(self, session_id):
        with self.conn.cursor() as cur:
            cur.execute(
                "UPDATE scrape_sessions SET status = 'completed', "
                "completed_at = NOW() WHERE id = %s",
                (session_id,))
