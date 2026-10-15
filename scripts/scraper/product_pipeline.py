#!/usr/bin/env python3
"""Product pipeline for processing scraped data."""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from scraper import ScrapedProduct


class ProductPipeline:
    """Process scraped products before saving to database."""

    def __init__(self, markup: float = 1.5):
        self.markup = markup

    def process(self, product: ScrapedProduct) -> ScrapedProduct:
        """Process a single product."""
        # Calculate our price
        if product.supplier_price:
            product.supplier_price = round(product.supplier_price, 2)
        else:
            product.supplier_price = None

        # Set scraped timestamp
        product.scraped_at = datetime.now(timezone.utc).isoformat()

        # Clean up data
        product = self._clean_product(product)

        return product

    def _clean_product(self, product: ScrapedProduct) -> ScrapedProduct:
        """Clean and normalize product data."""
        # Normalize name
        if product.name_en:
            product.name_en = product.name_en.strip()

        if product.name_ar:
            product.name_ar = product.name_ar.strip()

        # Normalize image URL
        if product.image_url:
            product.image_url = product.image_url.strip()

        # Remove duplicate images
        if product.image_urls:
            seen = set()
            unique_images = []
            for img in product.image_urls:
                if img and img not in seen:
                    seen.add(img)
                    unique_images.append(img)
            product.image_urls = unique_images

        return product

    def batch_process(self, products: List[ScrapedProduct]) -> List[ScrapedProduct]:
        """Process a batch of products."""
        return [self.process(p) for p in products]

    def calculate_our_price(self, supplier_price: float) -> float:
        """Calculate our selling price based on supplier price."""
        if supplier_price:
            return round(supplier_price * self.markup, 2)
        return None

    def calculate_profit(self, supplier_price: float, our_price: float,
                         quantity: int = 1) -> float:
        """Calculate profit for a product."""
        if supplier_price and our_price:
            return round((our_price - supplier_price) * quantity, 2)
        return 0.0
