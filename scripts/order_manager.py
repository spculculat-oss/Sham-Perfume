#!/usr/bin/env python3
"""
Order Management System for Sham Perfume.
Handles order creation, tracking, and status updates.
Works with the PostgreSQL database from scripts/db/database.py.
"""

import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict


@dataclass
class OrderItem:
    product_id: int
    product_name_ar: str
    product_name_en: str
    sku: str
    category: str
    quantity: int
    unit_price: float
    total_price: float
    supplier_id: Optional[int] = None


@dataclass
class Order:
    id: Optional[int] = None
    customer_id: str = ""
    items: List[OrderItem] = None
    status: str = "pending"
    shipping_address: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    supplier_order_id: Optional[str] = None
    supplier_tracking_number: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    paid_at: Optional[str] = None
    shipped_at: Optional[str] = None
    delivered_at: Optional[str] = None
    
    def __post_init__(self):
        if self.items is None:
            self.items = []
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc).isoformat()
        if self.updated_at is None:
            self.updated_at = self.created_at


class OrderManager:
    """
    Manages orders for the Sham Perfume platform.
    Handles order lifecycle: creation → confirmation → fulfillment → delivery.
    """
    
    def __init__(self, db):
        """
        Initialize with a Database instance.
        
        Args:
            db: Database instance from scripts.db.database
        """
        self.db = db
    
    def create_order(self, customer_id: str, items: List[OrderItem],
                     shipping_address: Optional[Dict] = None,
                     notes: Optional[str] = None) -> int:
        """
        Create a new order with multiple items.
        
        Args:
            customer_id: Unique customer identifier
            items: List of OrderItem objects
            shipping_address: Optional shipping address dict
            notes: Optional order notes
            
        Returns:
            Order ID
        """
        # Start transaction
        self.db.conn.autocommit = False
        
        try:
            # Calculate totals and create order
            total_price = sum(item.total_price for item in items)
            
            with self.db.conn.cursor() as cur:
                # Create order (using first item's product_id for simplicity)
                first_product_id = items[0].product_id if items else None
                first_unit_price = items[0].unit_price if items else 0
                
                cur.execute(
                    """INSERT INTO orders 
                    (customer_id, product_id, quantity, unit_price, total_price,
                     shipping_address, notes, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id""",
                    (customer_id, first_product_id, len(items),
                     first_unit_price, total_price,
                     json.dumps(shipping_address) if shipping_address else None,
                     notes, "pending")
                )
                order_id = cur.fetchone()[0]
                
                # Update order with actual quantity (total items)
                cur.execute(
                    "UPDATE orders SET quantity = %s WHERE id = %s",
                    (sum(item.quantity for item in items), order_id)
                )
                
                self.db.conn.commit()
                
            return order_id
            
        except Exception as e:
            self.db.conn.rollback()
            raise e
        finally:
            self.db.conn.autocommit = True
    
    def create_simple_order(self, customer_id: str, product_id: int,
                           quantity: int = 1, unit_price: float = 0,
                           shipping_address: Optional[Dict] = None,
                           notes: Optional[str] = None) -> int:
        """
        Create a simple order with a single product.
        
        Args:
            customer_id: Unique customer identifier
            product_id: Product ID to order
            quantity: Quantity to order
            unit_price: Price per unit
            shipping_address: Optional shipping address
            notes: Optional notes
            
        Returns:
            Order ID
        """
        total_price = round(unit_price * quantity, 2)
        
        with self.db.conn.cursor() as cur:
            cur.execute(
                """INSERT INTO orders 
                (customer_id, product_id, quantity, unit_price, total_price,
                 shipping_address, notes, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id""",
                (customer_id, product_id, quantity, unit_price,
                 total_price,
                 json.dumps(shipping_address) if shipping_address else None,
                 notes, "pending")
            )
            order_id = cur.fetchone()[0]
            
        return order_id
    
    def update_order_status(self, order_id: int, status: str) -> bool:
        """
        Update order status through its lifecycle.
        
        Valid statuses: pending, confirmed, processing, shipped, delivered, cancelled
        
        Args:
            order_id: Order ID
            status: New status
            
        Returns:
            True if successful
        """
        valid_statuses = ['pending', 'confirmed', 'processing', 
                         'shipped', 'delivered', 'cancelled', 'refunded']
        
        if status not in valid_statuses:
            raise ValueError(f"Invalid status: {status}. Must be one of {valid_statuses}")
        
        with self.db.conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET status = %s, updated_at = NOW() WHERE id = %s",
                (status, order_id)
            )
            
            # Set timestamp fields based on status
            if status == 'confirmed':
                cur.execute(
                    "UPDATE orders SET confirmed_at = NOW() WHERE id = %s",
                    (order_id,)
                )
            elif status == 'shipped':
                cur.execute(
                    "UPDATE orders SET shipped_at = NOW() WHERE id = %s",
                    (order_id,)
                )
            elif status == 'delivered':
                cur.execute(
                    "UPDATE orders SET delivered_at = NOW() WHERE id = %s",
                    (order_id,)
                )
            elif status == 'cancelled':
                cur.execute(
                    "UPDATE orders SET cancelled_at = NOW() WHERE id = %s",
                    (order_id,)
                )
            
        return True
    
    def mark_paid(self, order_id: int) -> bool:
        """Mark order as paid."""
        with self.db.conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET paid_at = NOW() WHERE id = %s",
                (order_id,)
            )
        return True
    
    def update_tracking(self, order_id: int, 
                       supplier_order_id: Optional[str] = None,
                       tracking_number: Optional[str] = None) -> bool:
        """
        Update supplier order and tracking information.
        
        Args:
            order_id: Order ID
            supplier_order_id: Supplier's order reference
            tracking_number: Shipping tracking number
        """
        with self.db.conn.cursor() as cur:
            if supplier_order_id:
                cur.execute(
                    "UPDATE orders SET supplier_order_id = %s WHERE id = %s",
                    (supplier_order_id, order_id)
                )
            if tracking_number:
                cur.execute(
                    "UPDATE orders SET supplier_tracking_number = %s WHERE id = %s",
                    (tracking_number, order_id)
                )
        return True
    
    def get_order(self, order_id: int) -> Optional[Dict]:
        """Get order by ID."""
        with self.db.conn.cursor() as cur:
            cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
            row = cur.fetchone()
            if row:
                result = dict(row)
                # Parse JSON fields
                if result.get('shipping_address'):
                    result['shipping_address'] = json.loads(result['shipping_address'])
                return result
            return None
    
    def get_orders_by_customer(self, customer_id: str, 
                               limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get all orders for a customer."""
        with self.db.conn.cursor() as cur:
            cur.execute(
                """SELECT * FROM orders 
                WHERE customer_id = %s 
                ORDER BY id DESC LIMIT %s OFFSET %s""",
                (customer_id, limit, offset)
            )
            rows = cur.fetchall()
            results = []
            for row in rows:
                result = dict(row)
                if result.get('shipping_address'):
                    result['shipping_address'] = json.loads(result['shipping_address'])
                results.append(result)
            return results
    
    def get_orders_by_status(self, status: str, 
                            limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get all orders with a specific status."""
        with self.db.conn.cursor() as cur:
            cur.execute(
                """SELECT * FROM orders 
                WHERE status = %s 
                ORDER BY created_at DESC LIMIT %s OFFSET %s""",
                (status, limit, offset)
            )
            rows = cur.fetchall()
            results = []
            for row in rows:
                result = dict(row)
                if result.get('shipping_address'):
                    result['shipping_address'] = json.loads(result['shipping_address'])
                results.append(result)
            return results
    
    def get_all_orders(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get all orders."""
        with self.db.conn.cursor() as cur:
            cur.execute(
                """SELECT * FROM orders 
                ORDER BY id DESC LIMIT %s OFFSET %s""",
                (limit, offset)
            )
            rows = cur.fetchall()
            results = []
            for row in rows:
                result = dict(row)
                if result.get('shipping_address'):
                    result['shipping_address'] = json.loads(result['shipping_address'])
                results.append(result)
            return results
    
    def count_orders(self, status: Optional[str] = None) -> int:
        """Count orders, optionally filtered by status."""
        with self.db.conn.cursor() as cur:
            if status:
                cur.execute(
                    "SELECT COUNT(*) FROM orders WHERE status = %s",
                    (status,)
                )
            else:
                cur.execute("SELECT COUNT(*) FROM orders")
            return cur.fetchone()[0]
    
    def get_pending_orders(self) -> List[Dict]:
        """Get all pending orders."""
        return self.get_orders_by_status('pending')
    
    def get_unshipped_orders(self) -> List[Dict]:
        """Get orders that haven't been shipped yet."""
        with self.db.conn.cursor() as cur:
            cur.execute(
                """SELECT * FROM orders 
                WHERE status NOT IN ('shipped', 'delivered', 'cancelled')
                ORDER BY created_at ASC"""
            )
            rows = cur.fetchall()
            results = []
            for row in rows:
                result = dict(row)
                if result.get('shipping_address'):
                    result['shipping_address'] = json.loads(result['shipping_address'])
                results.append(result)
            return results
    
    def cancel_order(self, order_id: int, reason: Optional[str] = None) -> bool:
        """
        Cancel an order.
        
        Args:
            order_id: Order ID
            reason: Optional cancellation reason
            
        Returns:
            True if cancelled successfully
        """
        order = self.get_order(order_id)
        if not order:
            return False
        
        # Can only cancel pending or confirmed orders
        if order['status'] not in ['pending', 'confirmed']:
            raise ValueError(f"Cannot cancel order in status: {order['status']}")
        
        self.update_order_status(order_id, 'cancelled')
        
        if reason:
            with self.db.conn.cursor() as cur:
                cur.execute(
                    "UPDATE orders SET notes = %s WHERE id = %s",
                    (f"Cancellation reason: {reason}", order_id)
                )
        
        return True
    
    def get_order_summary(self, order_id: int) -> Dict:
        """
        Get a human-readable summary of an order.
        
        Returns:
            Dict with order details formatted for display
        """
        order = self.get_order(order_id)
        if not order:
            return {"error": "Order not found"}
        
        summary = {
            "order_number": f"ORD-{order_id:06d}",
            "customer_id": order['customer_id'],
            "status": order['status'],
            "total_price": order['total_price'],
            "quantity": order['quantity'],
            "created_at": order['created_at'],
            "shipping_address": order.get('shipping_address'),
            "notes": order.get('notes'),
            "supplier_order_id": order.get('supplier_order_id'),
            "tracking_number": order.get('supplier_tracking_number'),
        }
        
        # Add timestamps
        if order.get('paid_at'):
            summary['paid_at'] = order['paid_at']
        if order.get('shipped_at'):
            summary['shipped_at'] = order['shipped_at']
        if order.get('delivered_at'):
            summary['delivered_at'] = order['delivered_at']
            
        return summary


# Convenience functions for simple usage
def create_order(db, customer_id: str, product_id: int,
                quantity: int = 1, unit_price: float = 0,
                shipping_address: Optional[Dict] = None,
                notes: Optional[str] = None) -> int:
    """Create a simple order."""
    manager = OrderManager(db)
    return manager.create_simple_order(
        customer_id, product_id, quantity, unit_price,
        shipping_address, notes
    )


def update_order_status(db, order_id: int, status: str) -> bool:
    """Update order status."""
    manager = OrderManager(db)
    return manager.update_order_status(order_id, status)


def get_order(db, order_id: int) -> Optional[Dict]:
    """Get order by ID."""
    manager = OrderManager(db)
    return manager.get_order(order_id)


def get_orders(db, customer_id: Optional[str] = None,
              status: Optional[str] = None,
              limit: int = 50, offset: int = 0) -> List[Dict]:
    """Get orders with optional filters."""
    manager = OrderManager(db)
    if customer_id:
        return manager.get_orders_by_customer(customer_id, limit, offset)
    elif status:
        return manager.get_orders_by_status(status, limit, offset)
    else:
        return manager.get_all_orders(limit, offset)


if __name__ == "__main__":
    # Example usage
    print("Order Manager Module")
    print("=" * 50)
    print("Usage:")
    print("  from scripts.db.database import Database")
    print("  from scripts.order_manager import OrderManager, create_order, update_order_status")
    print()
    print("  db = Database()")
    print("  db.connect()")
    print("  order_id = create_order(db, 'customer123', 1, 2, 50.0)")
    print("  update_order_status(db, order_id, 'shipped')")
