#!/usr/bin/env python3
"""
Test script for Order Manager.
Tests order creation, status updates, and queries.
"""

import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

from scripts.db.database import Database
from scripts.order_manager import (
    OrderManager, create_order, update_order_status,
    get_order, get_orders, create_simple_order
)


def test_order_manager():
    """Test the Order Manager functionality."""
    print("=" * 60)
    print("Testing Order Manager")
    print("=" * 60)
    
    # Connect to database
    print("\n1. Connecting to database...")
    try:
        db = Database(host='localhost', dbname='sham_perfume')
        db.connect()
        print("   ✓ Database connected")
    except Exception as e:
        print(f"   ✗ Database connection failed: {e}")
        print("\n   Note: This test requires a running PostgreSQL instance.")
        print("   For local testing, you can use the SQLite API instead.")
        return False
    
    # Create a test supplier (if not exists)
    print("\n2. Setting up test data...")
    with db.conn.cursor() as cur:
        cur.execute("SELECT id FROM suppliers WHERE name = %s", ("Test Supplier",))
        supplier_row = cur.fetchone()
        if not supplier_row:
            cur.execute(
                "INSERT INTO suppliers (name, website_url, status) VALUES (%s, %s, %s) RETURNING id",
                ("Test Supplier", "http://test.com", "vetting")
            )
            supplier_id = cur.fetchone()[0]
            print(f"   ✓ Created test supplier (ID: {supplier_id})")
        else:
            supplier_id = supplier_row[0]
            print(f"   ✓ Using existing supplier (ID: {supplier_id})")
        
        # Create a test product
        cur.execute("SELECT id FROM products WHERE sku = %s", ("TEST-ORDER-001",))
        product_row = cur.fetchone()
        if not product_row:
            cur.execute(
                """INSERT INTO products 
                (supplier_id, sku, name_ar, name_en, category, brand, 
                 supplier_price, our_price, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (supplier_id, "TEST-ORDER-001", "عطر اختبار", "Test Perfume",
                 "عطور", "Lattafa", 35.0, 52.5, True)
            )
            product_id = cur.fetchone()[0]
            print(f"   ✓ Created test product (ID: {product_id})")
        else:
            product_id = product_row[0]
            print(f"   ✓ Using existing product (ID: {product_id})")
    
    # Test creating a simple order
    print("\n3. Testing create_simple_order...")
    try:
        order_id = create_simple_order(
            db,
            customer_id="test_customer_001",
            product_id=product_id,
            quantity=2,
            unit_price=52.5,
            shipping_address={"city_ar": "القاهرة", "city_en": "Cairo"},
            notes="اختبار طلب"
        )
        print(f"   ✓ Order created with ID: {order_id}")
    except Exception as e:
        print(f"   ✗ Failed to create order: {e}")
        return False
    
    # Test getting the order
    print("\n4. Testing get_order...")
    order = get_order(db, order_id)
    if order:
        print(f"   ✓ Order retrieved:")
        print(f"     - Customer: {order['customer_id']}")
        print(f"     - Product: {order['product_id']}")
        print(f"     - Quantity: {order['quantity']}")
        print(f"     - Total: {order['total_price']} EGP")
        print(f"     - Status: {order['status']}")
    else:
        print(f"   ✗ Failed to retrieve order")
        return False
    
    # Test updating order status
    print("\n5. Testing update_order_status...")
    try:
        update_order_status(db, order_id, "confirmed")
        print("   ✓ Status updated to 'confirmed'")
        
        update_order_status(db, order_id, "shipped")
        print("   ✓ Status updated to 'shipped'")
    except Exception as e:
        print(f"   ✗ Failed to update status: {e}")
        return False
    
    # Test getting orders by customer
    print("\n6. Testing get_orders_by_customer...")
    orders = get_orders(db, customer_id="test_customer_001")
    print(f"   ✓ Found {len(orders)} orders for customer")
    for o in orders:
        print(f"     - Order #{o['id']}: {o['status']} ({o['total_price']} EGP)")
    
    # Test getting orders by status
    print("\n7. Testing get_orders_by_status...")
    shipped_orders = get_orders(db, status="shipped")
    print(f"   ✓ Found {len(shipped_orders)} shipped orders")
    
    # Test order summary
    print("\n8. Testing order summary...")
    manager = OrderManager(db)
    summary = manager.get_order_summary(order_id)
    print(f"   ✓ Order summary:")
    for key, value in summary.items():
        print(f"     - {key}: {value}")
    
    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
    
    db.close()
    return True


if __name__ == "__main__":
    success = test_order_manager()
    sys.exit(0 if success else 1)
