#!/usr/bin/env python3
"""Scraper for shamperfume.com"""

from typing import List, Optional
from bs4 import BeautifulSoup
import requests
from urllib.parse import urljoin

from scripts.scraper import BaseScraper, ScrapedProduct


class ShamPerfumeScraper(BaseScraper):
    """Scraper for shamperfume.com"""

    BASE_URL = "https://www.shamperfume.com"

    def get_product_list_urls(self) -> List[str]:
        """Return category pages to scrape."""
        categories = [
            "/perfumes",
            "/perfumes/kenz-de-rasasi",
            "/perfumes/1003-amouage-interlude-man",
        ]
        return [urljoin(self.BASE_URL, cat) for cat in categories]

    def scrape_product_list(self, url: str) -> List[ScrapedProduct]:
        """Scrape a product listing page."""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            products = []
            product_cards = soup.select(".product-item, .product-card, .product")

            for card in product_cards:
                try:
                    product = self._extract_product_from_card(card, url)
                    if product:
                        products.append(product)
                except Exception as e:
                    logger.warning(f"Failed to extract product from card: {e}")

            return products
        except Exception as e:
            logger.error(f"Failed to scrape product list {url}: {e}")
            return []

    def _extract_product_from_card(self, card: BeautifulSoup, url: str) -> Optional[ScrapedProduct]:
        """Extract product data from a card element."""
        name_elem = card.select_one(".product-name, .product-title, h2, h3, h4")
        name = name_elem.get_text(strip=True) if name_elem else None

        price_elem = card.select_one(".price, .product-price, [data-price]")
        price_text = price_elem.get_text(strip=True) if price_elem else None
        price = self._parse_price(price_text)

        image_elem = card.select_one(".product-image img, .image img, img.product-img")
        image_url = None
        if image_elem:
            image_url = image_elem.get("src") or image_elem.get("data-src")
            if image_url and not image_url.startswith("http"):
                image_url = urljoin(self.BASE_URL, image_url)

        sku = self._extract_sku(url, card)
        category = self._extract_category(url)

        return ScrapedProduct(
            sku=sku,
            name_en=name,
            image_url=image_url,
            supplier_price=price,
            url=url,
            category=category,
            scraped_at=self._now_iso(),
            supplier_id=self.supplier_id,
        )

    def _extract_product_detail(self, url: str) -> Optional[ScrapedProduct]:
        """Scrape a single product detail page for full data."""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            product = ScrapedProduct(
                url=url,
                supplier_id=self.supplier_id,
                scraped_at=self._now_iso(),
            )

            name_elem = soup.select_one(".product-title, .product-name, h1")
            if name_elem:
                product.name_en = name_elem.get_text(strip=True)

            desc_elem = soup.select_one(".product-description, .product-details")
            if desc_elem:
                product.description_en = desc_elem.get_text(strip=True)

            price_elem = soup.select_one(".price, .product-price, span.price")
            if price_elem:
                product.supplier_price = self._parse_price(price_elem.get_text(strip=True))

            image_elem = soup.select_one(".product-image img, .main-image img")
            if image_elem:
                product.image_url = image_elem.get("src") or image_elem.get("data-src")
                if product.image_url and not product.image_url.startswith("http"):
                    product.image_url = urljoin(self.BASE_URL, product.image_url)

            return product
        except Exception as e:
            logger.error(f"Failed to scrape product detail {url}: {e}")
            return None

    def _parse_price(self, price_text: Optional[str]) -> Optional[float]:
        """Parse price string to float."""
        if not price_text:
            return None
        import re
        cleaned = re.sub(r"[^\d.,]", "", price_text)
        try:
            return float(cleaned.replace(",", ""))
        except:
            return None

    def _extract_sku(self, url: str, card: BeautifulSoup) -> Optional[str]:
        """Extract SKU from URL or card."""
        parts = url.split("/")
        sku = parts[-1] if parts[-1] else None
        if sku and sku.endswith("/"):
            sku = sku[:-1]
        return sku

    def _extract_category(self, url: str) -> Optional[str]:
        """Extract category from URL."""
        parts = url.split("/")
        for i, part in enumerate(parts):
            if part == "perfumes" and i+1 < len(parts):
                return parts[i+1]
        return None

    def _now_iso(self) -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()
