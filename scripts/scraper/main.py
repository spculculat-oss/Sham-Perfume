#!/usr/bin/env python3
"""Main entry point for the perfume scraper."""

import argparse
import logging
import sys
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, '/home/user/Sham-Perfume')

from scripts.scraper import BaseScraper, ScrapedProduct
from scripts.scraper.shamperfume_scraper import ShamPerfumeScraper
from scripts.scraper.product_pipeline import ProductPipeline
from scripts.db.database import Database, ProductData


def setup_logging(log_level: str = 'INFO', log_file: str = 'scraper.log'):
    """Configure logging."""
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description='Perfume Product Scraper')
    parser.add_argument('--supplier', type=str, default='Sham Perfume',
                        help='Supplier name to scrape')
    parser.add_argument('--db-host', type=str, default='localhost')
    parser.add_argument('--db-port', type=int, default=5432)
    parser.add_argument('--db-name', type=str, default='sham_perfume')
    parser.add_argument('--db-user', type=str, default='postgres')
    parser.add_argument('--db-password', type=str, default='postgres')
    parser.add_argument('--log-level', type=str, default='INFO')
    parser.add_argument('--log-file', type=str, default='scraper.log')
    parser.add_argument('--dry-run', action='store_true',
                        help='Do not save to database')
    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.log_level, args.log_file)
    logger.info(f"Starting scraper for {args.supplier}")

    # Initialize database
    db = Database(
        host=args.db_host,
        port=args.db_port,
        dbname=args.db_name,
        user=args.db_user,
        password=args.db_password
    )
    db.connect()
    logger.info("Database connected")

    # Find or create supplier
    supplier = db.get_supplier_by_name(args.supplier)
    if not supplier:
        supplier_id = db.insert_supplier(
            name=args.supplier,
            website_url='https://www.shamperfume.com',
            status='approved',
            credibility_score=85
        )
        logger.info(f"Created supplier {args.supplier} with id {supplier_id}")
    else:
        supplier_id = supplier['id']
        logger.info(f"Using existing supplier {args.supplier} with id {supplier_id}")

    # Create scraper
    scraper = ShamPerfumeScraper(supplier_id=supplier_id, db=db)
    logger.info(f"Scraper created for {args.supplier}")

    # Get product URLs
    urls = scraper.get_product_list_urls()
    logger.info(f"Found {len(urls)} URLs to scrape: {urls}")

    # Scrape products
    all_products = []
    for url in urls:
        try:
            products = scraper.scrape_product_list(url)
            all_products.extend(products)
            logger.info(f"Scraped {len(products)} products from {url}")
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")

    logger.info(f"Total products scraped: {len(all_products)}")

    # Process and save products
    pipeline = ProductPipeline(markup=1.5)
    processed_products = pipeline.batch_process(all_products)

    saved_count = 0
    for product in processed_products:
        try:
            db_product = ProductData(
                sku=product.sku,
                name_ar=product.name_ar,
                name_en=product.name_en,
                description_ar=product.description_ar,
                description_en=product.description_en,
                image_url=product.image_url,
                image_urls=product.image_urls,
                category=product.category,
                brand=product.brand,
                supplier_price=product.supplier_price,
                specs=product.specs,
                url=product.url,
                scraped_at=product.scraped_at,
                supplier_id=product.supplier_id,
            )
            db.insert_product(supplier_id, db_product)
            saved_count += 1
            logger.info(f"Saved product: {product.name_en} (SKU: {product.sku})")
        except Exception as e:
            logger.error(f"Failed to save product {product.sku}: {e}")

    logger.info(f"Saved {saved_count} products to database")
    logger.info("Scraping completed successfully")

    # Close database
    db.close()
    logger.info("Database connection closed")


if __name__ == '__main__':
    main()
