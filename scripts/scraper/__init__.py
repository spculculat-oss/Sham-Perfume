#!/usr/bin/env python3
"""Base scraper class for all perfume site scrapers."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import logging
import time

logger = logging.getLogger(__name__)


@dataclass
class ScrapedProduct:
    """Product data extracted from a scraper."""
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

    def __post_init__(self):
        if self.image_urls is None:
            self.image_urls = []
        if self.specs is None:
            self.specs = {}

    def to_dict(self) -> Dict:
        return {
            'sku': self.sku,
            'name_ar': self.name_ar,
            'name_en': self.name_en,
            'description_ar': self.description_ar,
            'description_en': self.description_en,
            'image_url': self.image_url,
            'image_urls': self.image_urls,
            'category': self.category,
            'brand': self.brand,
            'supplier_price': self.supplier_price,
            'specs': self.specs,
            'url': self.url,
            'scraped_at': self.scraped_at,
            'supplier_id': self.supplier_id,
        }


class BaseScraper(ABC):
    """Abstract base class for all scrapers."""

    def __init__(self, supplier_id: int, db_conn=None):
        self.supplier_id = supplier_id
        self.db = db_conn
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

    @abstractmethod
    def get_product_list_urls(self) -> List[str]:
        """Return list of URLs to scrape for product listings."""
        pass

    @abstractmethod
    def scrape_product_list(self, url: str) -> List[ScrapedProduct]:
        """Scrape a product listing page and return product data."""
        pass

    def scrape_product_detail(self, url: str) -> Optional[ScrapedProduct]:
        """Scrape a single product detail page (optional)."""
        return None

    def run(self) -> List[ScrapedProduct]:
        """Main execution flow."""
        urls = self.get_product_list_urls()
        all_products = []

        for url in urls:
            try:
                products = self.scrape_product_list(url)
                all_products.extend(products)
                logger.info(f"Scraped {len(products)} products from {url}")
                time.sleep(1)
            except Exception as e:
                logger.error(f"Failed to scrape {url}: {e}")

        if self.db:
            for product in all_products:
                try:
                    self.db.insert_product(self.supplier_id, product)
                except Exception as e:
                    logger.error(f"Failed to save product {product.sku}: {e}")

        return all_products

    def _now_iso(self) -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()
