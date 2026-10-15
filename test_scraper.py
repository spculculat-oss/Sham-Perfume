#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/user/Sham-Perfume')

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from scripts.scraper.shamperfume_scraper import ShamPerfumeScraper

# Test with better headers
scraper = ShamPerfumeScraper(supplier_id=1)
scraper.headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
}

urls = scraper.get_product_list_urls()
print("URLs:", urls)

if urls:
    print(f"\nScraping: {urls[0]}")
    try:
        products = scraper.scrape_product_list(urls[0])
        print(f"Products: {len(products)}")
        for p in products[:10]:
            print(f"  - {p.name_en} | {p.supplier_price} | {p.sku}")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        # Try with verify=False
        print("\nTrying with verify=False...")
        try:
            import requests
            response = requests.get(urls[0], headers=scraper.headers, timeout=10, verify=False)
            print(f"Status: {response.status_code}")
            print(f"Length: {len(response.text)}")
        except Exception as e2:
            print(f"Also failed: {e2}")

print("\nDone")
