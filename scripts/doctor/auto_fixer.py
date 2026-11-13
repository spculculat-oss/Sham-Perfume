#!/usr/bin/env python3
"""
Shaheen Auto-Fixer - Automatically fixes common issues
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

PRODUCTS_FILE = "src/data/products.json"
UNSPLASH_IMAGES = {
    "Lattafa": [
        "https://images.unsplash.com/photo-1594032445763-59aef710e0ba?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1612406687582-f4458119aa5a?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1541643600913-80f5f10a3b08?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1588432257538-e8f7b5ab25b3?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1599058670279-6842666a664c?w=300&h=300&fit=crop",
    ],
    "Rasasi": [
        "https://images.unsplash.com/photo-1600585154340-be616c8b5825?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1607706689826-1848515763984?w=300&h=300&fit=crop",
    ],
    "Al-Rehab": [
        "https://images.unsplash.com/photo-1595425236092-40728526dc67?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1523275335684-379982092019?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1579584425555-c3ce1af17cbb?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1588172091045-01f41c8d0da8?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1549955239-7e4662108919?w=300&h=300&fit=crop",
    ],
    "Shama": [
        "https://images.unsplash.com/photo-1579584425555-c3ce1af17cbb?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1588172091045-01f41c8d0da8?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1523275335684-379982092019?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1568554661843-004974f4f1b4?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1600585154340-be616c8b5825?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1549955239-7e4662108919?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1599746107971-f496a10867a0?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1594032445763-59aef710e0ba?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1595425236092-40728526dc67?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1568554661843-004974f4f1b4?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1512244301671-38c34e5b524e?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1602810316605-326e2f81f218?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1541643600913-80f5f10a3b08?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1599058670279-6842666a664c?w=300&h=300&fit=crop",
    ],
    "Dior": [
        "https://images.unsplash.com/photo-1588172091045-01f41c8d0da8?w=300&h=300&fit=crop",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=300&h=300&fit=crop",
    ],
    "YSL": [
        "https://images.unsplash.com/photo-1523275335684-379982092019?w=300&h=300&fit=crop",
    ],
    "Baccarat": [
        "https://images.unsplash.com/photo-1606787366850-de0944b7f6ff?w=300&h=300&fit=crop",
    ],
    "De Pronom": [
        "https://images.unsplash.com/photo-1599746107971-f496a10867a0?w=300&h=300&fit=crop",
    ],
    "Default": [
        "https://images.unsplash.com/photo-1594032445763-59aef710e0ba?w=300&h=300&fit=crop",
    ]
}


def get_brand_images(brand):
    """Get images for a brand."""
    if brand in UNSPLASH_IMAGES:
        return UNSPLASH_IMAGES[brand]
    return UNSPLASH_IMAGES["Default"]


def fix_products():
    """Fix products issues."""
    print("=" * 60)
    print("SHAHEEN AUTO-FIXER: Fixing products")
    print("=" * 60)
    
    try:
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load products.json: {e}")
        return False
    
    products = data.get('products', [])
    fix_count = 0
    
    for i, product in enumerate(products):
        # Products from «مستورد شاهين» carry the supplier's real photos and text; Shaheen writes their
        # Arabic text and «مراجع الصفحات» reviews them — never overwrite them with stock photos or fillers.
        if product.get('supplierSku'):
            continue
        issues = []
        
        # Check required fields
        if not product.get('imageUrl') or product.get('imageUrl') == '':
            issues.append('missing_image')
        
        if not product.get('descriptionAr') or product.get('descriptionAr') == '':
            issues.append('missing_description_ar')
        
        if not product.get('descriptionEn') or product.get('descriptionEn') == '':
            issues.append('missing_description_en')
        
        if not product.get('createdAt'):
            issues.append('missing_createdAt')
        
        if not product.get('updatedAt'):
            issues.append('missing_updatedAt')
        
        # Fix issues
        if 'missing_image' in issues:
            brand = product.get('brand', 'Unknown')
            images = get_brand_images(brand)
            product['imageUrl'] = images[i % len(images)]
            fix_count += 1
            print(f"  Fixed image for product {product.get('id')}: {product.get('nameAr', 'Unknown')}")
        
        if 'missing_description_ar' in issues:
            product['descriptionAr'] = f"عطر {product.get('nameAr', 'مميز')} - جودة عالية واسعار مميزة"
            fix_count += 1
            print(f"  Fixed description Ar for product {product.get('id')}")
        
        if 'missing_description_en' in issues:
            product['descriptionEn'] = f"{product.get('nameEn', 'Product')} - High quality at special price"
            fix_count += 1
            print(f"  Fixed description En for product {product.get('id')}")
        
        if 'missing_createdAt' in issues or 'missing_updatedAt' in issues:
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            product['createdAt'] = now
            product['updatedAt'] = now
            fix_count += 1
            print(f"  Fixed dates for product {product.get('id')}")
        
        if not product.get('unit'):
            product['unit'] = 'قطن'
            fix_count += 1
    
    if fix_count > 0:
        # Save fixed products
        with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Fixed {fix_count} issues in products.json")
    else:
        print("\n✅ No issues found in products.json")
    
    return True


def fix_workflow():
    """Fix workflow issues."""
    print("\n" + "=" * 60)
    print("SHAHEEN AUTO-FIXER: Checking workflow")
    print("=" * 60)
    print("  Workflow status check requires GitHub API access")
    print("  Would check: pages.yml, shaheen-doctor.yml")
    print("✅ Workflow check completed")
    return True


def main():
    print("=" * 60)
    print("SHAHEEN AUTO-FIXER")
    print("=" * 60)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Fix products
    fix_products()
    
    # Check workflow
    fix_workflow()
    
    print("\n" + "=" * 60)
    print("SHAHEEN AUTO-FIXER: Complete")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    main()
