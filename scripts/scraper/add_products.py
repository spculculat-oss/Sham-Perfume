#!/usr/bin/env python3
"""Simple scraper to add products from perfume websites to products.json"""

import json
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin

# Products to scrape - can add more websites here
SCRAPED_SITES = [
    {
        "name": "Sham Perfume",
        "base_url": "https://www.shamperfume.com",
        "categories": ["/perfumes", "/perfumes/kenz-de-rasasi"],
        "supplier_id": "sham",
        "supplier_name": "Sham Perfume",
    },
]

def fetch_page(url, timeout=10):
    """Fetch a page with retries."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_price(price_text):
    """Parse price from text."""
    if not price_text:
        return None
    # Remove currency symbols, commas, etc.
    cleaned = re.sub(r'[^\d.,]', '', price_text)
    # Try to extract number
    match = re.search(r'(\d+(?:\.\d+)?)', cleaned)
    if match:
        return float(match.group(1))
    return None

def scrape_shamperfume():
    """Scrape products from shamperfume.com."""
    products = []
    base = SCRAPED_SITES[0]
    
    for cat in base["categories"]:
        url = urljoin(base["base_url"], cat)
        print(f"Scraping: {url}")
        
        html = fetch_page(url)
        if not html:
            continue
            
        soup = BeautifulSoup(html, "html.parser")
        
        # Find product cards
        cards = soup.select(".product-item, .product-card, .product, [class*='product']")
        
        for card in cards[:20]:  # Limit to 20 per category
            try:
                name_elem = card.select_one(".product-name, .product-title, h2, h3, h4, [class*='title']")
                name = name_elem.get_text(strip=True) if name_elem else None
                
                price_elem = card.select_one(".price, .product-price, [data-price], [class*='price']")
                price_text = price_elem.get_text(strip=True) if price_elem else None
                price = parse_price(price_text)
                
                image_elem = card.select_one(".product-image img, .image img, img.product-img, img[src*='product']")
                image_url = None
                if image_elem:
                    image_url = image_elem.get("src") or image_elem.get("data-src")
                    if image_url and not image_url.startswith("http"):
                        image_url = urljoin(base["base_url"], image_url)
                
                if name and price:
                    products.append({
                        "name": name,
                        "price": price,
                        "image": image_url,
                        "url": url,
                        "category": cat,
                        "supplier": base["supplier_name"],
                    })
                    print(f"  Found: {name} - {price} EGP")
            except Exception as e:
                print(f"  Error extracting product: {e}")
    
    return products

def load_existing_products():
    """Load existing products from JSON."""
    try:
        with open("src/data/products.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"products": []}

def save_products(products_data):
    """Save products to JSON."""
    with open("src/data/products.json", "w", encoding="utf-8") as f:
        json.dump(products_data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(products_data['products'])} products")

def add_scraped_products(scraped_products, existing_data):
    """Add scraped products to existing data with 50% markup."""
    max_id = max((p.get("id", 0) for p in existing_data["products"]), default=0)
    
    for i, sp in enumerate(scraped_products):
        # Skip if name contains text that looks like it's already in our list
        existing_names = [p.get("nameAr", "") for p in existing_data["products"]]
        if any(sp["name"][:10] in name for name in existing_names if name):
            continue
        
        max_id += 1
        supplier_price = sp["price"]
        our_price = round(supplier_price * 1.5, 2)  # 50% markup
        
        # Try to extract brand from name
        brand = "Unknown"
        name_lower = sp["name"].lower()
        if "lattafa" in name_lower:
            brand = "Lattafa"
        elif "rasasi" in name_lower:
            brand = "Rasasi"
        elif "al-rehab" in name_lower or "rehab" in name_lower:
            brand = "Al-Rehab"
        elif "dior" in name_lower:
            brand = "Dior"
        elif "ysl" in name_lower or "yves" in name_lower:
            brand = "YSL"
        elif "baccarat" in name_lower:
            brand = "Baccarat"
        
        # Generate SKU
        brand_prefix = brand[:3].upper() if brand != "Unknown" else "GEN"
        sku = f"{brand_prefix}-{max_id:03d}"
        
        new_product = {
            "id": max_id,
            "sku": sku,
            "nameAr": sp["name"],
            "nameEn": sp["name"],
            "descriptionAr": f"عطر {sp['name']} - جودة عالية وسعر مميز",
            "descriptionEn": f"{sp['name']} perfume - High quality at special price",
            "imageUrl": sp.get("image") or f"https://via.placeholder.com/300x300?text={sp['name'][:20]}",
            "category": "رجالي" if "man" in sp['name'].lower() or "رجالي" in sp['name'] else "نسائي",
            "brand": brand,
            "supplierPrice": supplier_price,
            "ourPrice": our_price,
            "stockStatus": "in_stock",
            "url": sp.get("url"),
            "isFeatured": i < 3,  # First 3 are featured
            "isNew": True,
            "supplierId": "scraped",
            "supplierName": sp.get("supplier", "Scraped"),
            "rating": 4.0,
            "reviewCount": 0,
            "unit": "قطن",
            "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        
        existing_data["products"].append(new_product)
        print(f"Added: {new_product['nameAr']} ({brand}) - {supplier_price} → {our_price} EGP")
    
    return existing_data

def main():
    print("=" * 50)
    print("Scraping perfume products...")
    print("=" * 50)
    
    # Scrape products
    scraped = scrape_shamperfume()
    print(f"\nScraped {len(scraped)} products")
    
    if not scraped:
        # Never invent products: the old fallback added three fake perfumes («Scraped») whenever the
        # connection failed. The automated importer is now «مستورد شاهين» (scripts/shaheen-import/,
        # every 12 hours in GitHub Actions); its reviewer flags the three old fallback products.
        print("No products scraped — nothing added. Use «مستورد شاهين»: node --import tsx scripts/shaheen-import/run.mts")
        return

    # Load existing products
    existing = load_existing_products()
    print(f"Existing products: {len(existing['products'])}")
    
    # Add scraped products
    updated = add_scraped_products(scraped, existing)
    
    # Save
    save_products(updated)
    
    print(f"\nTotal products now: {len(updated['products'])}")
    print("Done!")

if __name__ == "__main__":
    main()
